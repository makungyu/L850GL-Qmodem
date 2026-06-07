# LuCI App XModem Next

Modern JavaScript-based LuCI interface for XModem management.

## Features

- **Modern UI**: Built with LuCI's modern JavaScript framework
- **Real-time Monitoring**: Auto-refresh modem status every 5 seconds
- **Multiple Modems**: Support for multiple modem configurations
- **Comprehensive Information**: 
  - Basic modem information (Model, IMEI, Firmware, etc.)
  - Network information (Signal strength, Network type, Cell ID, etc.)
  - Cell information (Band, PCI, EARFCN, etc.)
  - SIM information (ICCID, IMSI, Phone number, etc.)
- **AT Command Interface**: Send custom AT commands with quick command shortcuts
- **Modem Control**: Soft and hard reboot options
- **Configuration Management**: Easy UCI-based configuration
- **Responsive Design**: Works on desktop and mobile devices

## Installation

```bash
# Install the package
opkg install luci-app-xmodem-next

# Restart services
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

## Dependencies

- xmodem: Core XModem package
- luci-base: LuCI base framework
- rpcd: RPC daemon for ubus calls

## File Structure

```
luci-app-xmodem-next/
├── Makefile
├── README.md
├── htdocs/
│   └── luci-static/
│       └── resources/
│           ├── xmodem/
│           │   └── xmodem.js          # XModem API wrapper
│           └── view/
│               └── xmodem/
│                   ├── overview.js    # Overview page
│                   ├── config.js      # Configuration page
│                   ├── debug.js       # Debug/AT command page
│                   └── settings.js    # Settings page
├── root/
│   └── usr/
│       └── share/
│           ├── luci/
│           │   └── menu.d/
│           │       └── luci-app-xmodem-next.json  # Menu definition
│           └── rpcd/
│               └── acl.d/
│                   └── luci-app-xmodem-next.json  # Access control
└── po/
    └── zh_Hans/
        └── luci-app-xmodem-next.po    # Chinese translation
```

## Usage

### Accessing the Interface

1. Navigate to **Modem → XModem** in LuCI web interface
2. View modem status in the Overview page
3. Configure modems in the Configuration page
4. Send AT commands in the Debug page
5. Adjust global settings in the Settings page

### Configuration

Create or edit `/etc/config/xmodem`:

```
config modem 'modem1'
	option enabled '1'
	option name 'Main Modem'
	option path '/sys/bus/usb/devices/1-1'
	option manufacturer 'Quectel'
	option platform 'RG500Q'
	option at_port '/dev/ttyUSB2'
	option data_interface 'wwan0'
	option proto 'qmi'
	option pdp_index '1'
	option auto_apn '1'

config global
	option enabled '1'
	option debug '0'
	option log_level 'info'
	option scan_interval '30'
	option auto_detect '1'

config dial
	option enabled '1'
	option interval '10'
	option retry '3'
	option timeout '30'
```

### API Usage

The XModem API can be accessed via ubus:

```bash
# Get modem base information
ubus call xmodem base_info '{"config_section":"modem1"}'

# Get network information
ubus call xmodem network_info '{"config_section":"modem1"}'

# Send AT command
ubus call xmodem send_at '{"config_section":"modem1","params":{"port":"/dev/ttyUSB2","at":"AT+CIMI"}}'

# Reboot modem
ubus call xmodem do_reboot '{"config_section":"modem1","params":{"method":"soft"}}'
```

## Development

### Adding New Features

1. Edit the appropriate view file in `htdocs/luci-static/resources/view/xmodem/`
2. Add new API methods in `htdocs/luci-static/resources/xmodem/xmodem.js`
3. Update translations in `po/zh_Hans/luci-app-xmodem-next.po`
4. Update ACL permissions in `root/usr/share/rpcd/acl.d/luci-app-xmodem-next.json`

### Building

```bash
cd luci-app-xmodem-next
make package/luci-app-xmodem-next/compile V=s
```

## License

GPLv3

## Author

Tom <fjrcn@outlook.com>

## Changelog

### Version 1.0.0
- Initial release with modern JavaScript UI
- Support for multiple modems
- Real-time status monitoring
- AT command interface
- Comprehensive modem information display
