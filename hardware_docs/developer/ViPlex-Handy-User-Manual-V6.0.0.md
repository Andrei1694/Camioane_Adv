# ViPlex Handy V6.0.0

Source: [ViPlex-Handy-User-Manual-V6.0.0.pdf](../ViPlex-Handy-User-Manual-V6.0.0.pdf) Version: V6.0.0 (filename).

**Audience:** Mobile, backend, web. **Use:** Understand current-snapshot mobile setup, publishing and device capability checks.

## Useful facts

- Local devices are added through Wi-Fi AP or IP/range search, then authenticated separately with the device account. Default passwords come from its label/quick-start guide; hotspot QR connection is TU-only. ([PDF p. 5-7, 3.1 Add Devices](../ViPlex-Handy-User-Manual-V6.0.0.pdf#page=5))
- Local live view exposes screenshots, brightness, volume and playback controls. Controls vary by connection and device type; [TU-only media playback/mirroring (PDF pp. 26–28, Media Playback / Wireless Screen Mirroring)](../ViPlex-Handy-User-Manual-V6.0.0.pdf#page=26) must not be assumed on TB60. ([PDF p. 7-8, 3.2 Live View](../ViPlex-Handy-User-Manual-V6.0.0.pdf#page=7))
- Phone solution editing supports images, video, text and widgets. The media table caps input video at 4096 × 2160 and describes automatic transcoding; HDMI IN widgets are TU40 Pro/TU4K Pro-only. ([PDF p. 14-15, 3.4.3 Edit Solutions](../ViPlex-Handy-User-Manual-V6.0.0.pdf#page=14))
- Publishing is model-dependent: multiple splicing solutions cannot publish together, and TU disallows the documented multi-solution/multi-device publish options. Unsupported solutions may be transcoded by Handy. ([PDF p. 22-23, 3.4.4 Publish Solutions](../ViPlex-Handy-User-Manual-V6.0.0.pdf#page=22))
- The capability table distinguishes Taurus, TU and NS. Brightness sensing, cellular access and RF/GPS synchronization require hardware; NS-only timed player On/Off is separate from Taurus relay power control. ([PDF p. 29-34, 3.7 Screen Management](../ViPlex-Handy-User-Manual-V6.0.0.pdf#page=29))
- Synchronous playback needs synchronized time and identical content. Standalone USB mode plays numbered image/video files without a device password once enabled. ([PDF p. 40-45, Time Synchronization / Synchronous Playback / Standalone Playback](../ViPlex-Handy-User-Manual-V6.0.0.pdf#page=40))
- TB60 mosaic requires same-model, same-firmware, equal-specification screens, horizontal HDMI chaining, at most ten screens and maximum width 4096 pixels. ([PDF p. 45-47, 3.7.11 Multi-Screen Mosaic](../ViPlex-Handy-User-Manual-V6.0.0.pdf#page=45))
- Cloud devices, solutions and media each require Internet access and relevant VNNOX permissions. Handy can edit only cloud solutions created with Handy; cloud deletion of a device unbinds it. ([PDF p. 61-67, 4 Cloud Screen Management](../ViPlex-Handy-User-Manual-V6.0.0.pdf#page=61))
- Upgrades can restart/disconnect devices. Binding troubleshooting includes no Internet, older-firmware same-LAN requirements, large clock differences and an existing binding to another account. ([PDF p. 69-73, 5 FAQ](../ViPlex-Handy-User-Manual-V6.0.0.pdf#page=69))

## App implications and unknowns

The manual supplies vendor-app behavior, not local endpoint, discovery or SDK definitions. Direct device media and mirroring restrictions are detailed on PDF pp. 26–28. Automatic Handy transcoding does not mean the public publishing API will transcode our uploads. Confirm firmware and hardware before copying controls into the mobile app.
