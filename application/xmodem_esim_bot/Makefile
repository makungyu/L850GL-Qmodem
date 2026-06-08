include $(TOPDIR)/rules.mk

include ../../version.mk

PKG_NAME:=xmodem-esim-bot
PKG_VERSION:=$(XMODEM_VERSION)
PKG_RELEASE:=$(XMODEM_RELEASE)

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  PKGARCH:=all
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=Telegram bot for XModem eSIM management
  DEPENDS:=+ucode +curl +jq +lpac
  URL:=https://github.com/mkuruyuk/XModem
endef

define Package/$(PKG_NAME)/description
  Telegram bot for remote eSIM profile management on OpenWrt.
  Supports: profile list, switch, download, delete, modem status.
  Uses long-polling (no webhook server needed).
  Implemented in ucode for low memory usage and fast startup.
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/xmodem_esim_bot
endef

define Build/Prepare
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/xmodem-esim-bot $(1)/usr/bin/xmodem-esim-bot

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/xmodem_esim_bot $(1)/etc/config/xmodem_esim_bot

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/xmodem_esim_bot $(1)/etc/init.d/xmodem_esim_bot
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
