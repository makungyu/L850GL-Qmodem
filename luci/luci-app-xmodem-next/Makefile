# Copyright (C) 2024 Tom <fjrcn@outlook.com>
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

# Include unified version
include ../../version.mk

LUCI_TITLE:=LuCI Modern UI for XModem(Not Support Lua Version)
LUCI_DEPENDS:=+xmodem +luci-base +sms-forwarder-next
CONFFILES:=luci-app-xmodem
LUCI_PKGARCH:=all
PKG_VERSION:=$(XMODEM_VERSION)
PKG_RELEASE:=1
PKG_LICENSE:=GPLv3
PKG_MAINTAINER:=Tom <fjrcn@outlook.com>

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
