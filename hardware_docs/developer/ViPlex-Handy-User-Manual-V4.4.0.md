# ViPlex Handy V4.4.0

Source: [ViPlex-Handy-User-Manual-V4.4.0.pdf](../ViPlex-Handy-User-Manual-V4.4.0.pdf) Version: V4.4.0 (filename); original source date unknown.

**Audience:** Mobile, backend, web. **Use:** Understand older mobile local/cloud workflows and setup limits.

## Useful facts

- LAN control connects through player Wi-Fi AP or a shared LAN; Internet control uses VNNOX. Device discovery, player login and cloud login are separate steps. ([PDF p. 5-7, Device Control Methods / Device Connection](../ViPlex-Handy-User-Manual-V4.4.0.pdf#page=5))
- This edition shows legacy default credentials and an AP-prefixed SSID. It prompts users to change weak passwords; newer guides instead refer to the device label. ([PDF p. 6-7, Device Connection](../ViPlex-Handy-User-Manual-V4.4.0.pdf#page=6))
- Receiving-card connection setup is a technical-support feature; sending .rcfgx files is Android-only. Some edit/delete operations require firmware V3.5.0+ and backup ports cannot drive additional mapped cards in the illustrated configuration. ([PDF p. 8-11, Screen Configuration](../ViPlex-Handy-User-Manual-V4.4.0.pdf#page=8))
- VNNOX Care binding is separate from Standard/AD publishing. If the phone has no Internet, Care configuration files can be stored locally and binding completed later. ([PDF p. 11-15, Binding to VNNOX Care / Device Management](../ViPlex-Handy-User-Manual-V4.4.0.pdf#page=11))
- For TB60 and the named third-generation models, AP/STA switching requires V3.6.2+. Mobile data and ambient-light readings need a cellular module and light sensor respectively. ([PDF p. 16, Device Management](../ViPlex-Handy-User-Manual-V4.4.0.pdf#page=16))
- Local solutions have multiple windows and ordered media. Cloud media is downloaded to the phone when saving; publishing requires connected local devices and adequate device storage. ([PDF p. 19-24, Local Solutions](../ViPlex-Handy-User-Manual-V4.4.0.pdf#page=19))
- Internet controls are permission-dependent. Cloud solutions created with Handy are editable there; media upload and cloud publishing require Internet access and appropriate VNNOX permissions. ([PDF p. 25-28, Internet Control](../ViPlex-Handy-User-Manual-V4.4.0.pdf#page=25))
- The TB60 mosaic workflow uses equal-resolution screens connected horizontally by HDMI and publishes to the starting screen. It differs from the older T6/TB4/TB6/TB8 procedure. ([PDF p. 33-36, How to set multi-screen mosaic?](../ViPlex-Handy-User-Manual-V4.4.0.pdf#page=33))
- Below V2.3.0, upgrades require that intermediate version; very old firmware can block Handy use. Binding failures include no Internet, older-firmware LAN requirements, or an existing cloud binding. ([PDF p. 30-33, Firmware upgrade / Cloud binding FAQ](../ViPlex-Handy-User-Manual-V4.4.0.pdf#page=30))

## App implications and unknowns

This is an operator-tool guide, not an Expo-compatible SDK. Treat the model-restricted video-control list and credential examples as historical, not universal TB60 limits. [V6.0.0](ViPlex-Handy-User-Manual-V6.0.0.md) has a different feature matrix and publishing behavior; confirm installed versions and supplier integration support.
