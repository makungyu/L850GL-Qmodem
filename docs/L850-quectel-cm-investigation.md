# quectel-CM-M on Fibocom L850-GL (XMM7360) — investigation & verdict

Status: **not viable as a production dialer for L850.** Control plane works after
three fixes, but the **data plane does not carry traffic** on this modem. The
default/production L850 MBIM dialer is the **libmbim/mbimcli path** in
`modem_dial.sh` (`mbim_dial_intel`), which is fully validated and stable. The
quectel-CM-M path is kept **opt-in/dormant** behind `uci ... mbim_use_cm=1`.

All findings below were verified live on the device by cross-compiling
`quectel-CM-M` (static, musl armv7) and tracing it with `-v`.

## Layers found (control plane) — all fixed
1. **MBIM_CID_CONNECT rejected, status 9 (NO_DEVICE_SUPPORT).**
   Cause: for dual-stack it sent `IPType = MBIMContextIPTypeIPv4AndIPv6 (4)`,
   which XMM does not support. ModemManager/libmbim connect this exact modem with
   `ip-type ipv4v6 (3)`. Fix (`mbim-cm.c` requestSetupDataCall): use `IPv4v6 (3)`.
2. **MBIM_CID_DEVICE_SERVICES is ignored by the modem (no response).**
   Sending it eats a 30s control-channel timeout that desyncs every subsequent
   command (that is why RADIO_STATE etc. failed after it). Proven positional-safe
   by sending DEVICE_CAPS twice (both OK). Fix (`mbim-cm.c` mbim_init): **skip**
   the (optional) DEVICE_SERVICES query entirely.
3. **Activated⇄Deactivated flap every ~15s.**
   `SIG_EVENT_START` set status=CONNECTED but applied the IP/brought wwan0 up only
   on the *periodic* `SIG_EVENT_CHECK`; XMM deactivates the un-configured session
   before that first check. Fix (`main.c`): call `usbnet_link_change(link)`
   immediately after a successful connect. Result: session holds, IP applied,
   wwan0 in the firewall zone, default route added — **no more flap**.

## Layer that blocks it (data plane) — NOT solved
With all three fixes, quectel-CM-M reaches a **stable `ActivationState=Activated`
session with IP**, but **no traffic flows**: during ping, `wwan0` counters show
`tx_packets` increasing while `rx_packets` stays at 0 (packets leave the host,
the modem returns nothing). The same `wwan0` carries data perfectly under the
libmbim/mbimcli dialer and under ModemManager. The modem accepts quectel-CM-M's
session at the control level but does not forward its data — a low-level
cdc_mbim data-plane incompatibility specific to XMM. Solving it would require
matching exactly what libmbim + the kernel/netifd do, i.e. effectively using
libmbim.

## Decision
Use the **libmbim/mbimcli dialer** (default). It already provides MM-grade
behavior (in-place 0-loss re-IP, self-healing reconnect ladder). The quectel-CM-M
fixes above are committed and dormant so the investigation is preserved and
reproducible, not a mystery.
