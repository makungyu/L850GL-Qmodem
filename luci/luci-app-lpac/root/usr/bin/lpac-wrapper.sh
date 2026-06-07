#!/bin/sh
# /usr/bin/lpac — OpenWrt wrapper for /usr/lib/lpac
# Auto-configures LPAC environment variables based on APDU backend.
# Supports QMI (default), AT, and MBIM backends.
#
# Usage:
#   lpac chip info                        # uses defaults (QMI)
#   LPAC_APDU=at lpac profile list        # override to AT
#   LPAC_APDU=mbim lpac chip info         # override to MBIM

export LPAC_APDU="${LPAC_APDU:-qmi}"
export LPAC_HTTP="${LPAC_HTTP:-curl}"

case "$LPAC_APDU" in
    qmi)
        export LPAC_APDU_QMI_DEVICE="${LPAC_APDU_QMI_DEVICE:-/dev/cdc-wdm0}"
        export LPAC_APDU_QMI_UIM_SLOT="${LPAC_APDU_QMI_UIM_SLOT:-1}"
        ;;
    mbim)
        export LPAC_APDU_MBIM_DEVICE="${LPAC_APDU_MBIM_DEVICE:-/dev/cdc-wdm0}"
        # LPAC_APDU_MBIM_PROXY=1 if set externally
        ;;
    at)
        export LPAC_APDU_AT_DEVICE="${LPAC_APDU_AT_DEVICE:-/dev/ttyUSB3}"
        ;;
esac

exec /usr/lib/lpac "$@"
