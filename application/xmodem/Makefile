include $(TOPDIR)/rules.mk
include $(INCLUDE_DIR)/kernel.mk

# Include unified version
include ../../version.mk

PKG_NAME:=xmodem
PKG_RELEASE:=$(XMODEM_RELEASE)
PKG_VERSION:=$(XMODEM_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=XModem scripts
  # L850-GL (XMM7360) uses MBIM (cdc_mbim) by default and NCM (cdc_ncm) as the
  # alternate; AT is on cdc-acm (ttyACM). No vendor QMI/MHI drivers or quectel-CM
  # are needed (the data session is driven by mbimcli/libmbim).
  DEPENDS:=	\
  		+kmod-usb2 +kmod-usb3 \
		+kmod-usb-serial +kmod-usb-serial-option \
		+kmod-usb-net +kmod-usb-acm +kmod-usb-wdm \
		+kmod-usb-net-cdc-mbim \
		+kmod-usb-net-cdc-ncm \
		+ubus-at-daemon +tom_modem +terminfo +sms-tool_q \
		+modem_scan \
		+mbim-utils \
		+ndisc6 \
		+jq +bc \
		+coreutils +coreutils-stat \
		+usbutils
endef

define Package/$(PKG_NAME)/description
	XModem scripts
endef

define Build/Prepare
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
		$(CP) ./files/* $(1)/
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
