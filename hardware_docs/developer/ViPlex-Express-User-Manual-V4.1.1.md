# ViPlex Express V4.1.1

Source: [ViPlex-Express-User-Manual-V4.1.1.pdf](../ViPlex-Express-User-Manual-V4.1.1.pdf) Version: V4.1.1 (filename).

**Audience:** Mobile, backend, web. **Use:** Understand local commissioning, media delivery and firmware-dependent features.

## Useful facts

- Windows async mode stores playlists on players; demo mode creates virtual screens. With Taurus V5.1.0+ and Express V4.1.0+, first connection can assign a valid address to a player using factory static IP 192.168.0.10. ([PDF p. 4-11, Software Description / Hardware Connection / Log In to Screens](../ViPlex-Express-User-Manual-V4.1.1.pdf#page=4))
- USB playlist/schedule export requires matching device credentials. Plug-and-play keeps the drive attached; copy-and-play permits removal after copying. [Simple USB Playback (PDF pp. 60–61, Playback Configuration)](../ViPlex-Express-User-Manual-V4.1.1.pdf#page=60) is separately enabled and does not require a connection password. ([PDF p. 16-17, 4.4 USB Playback](../ViPlex-Express-User-Manual-V4.1.1.pdf#page=16))
- Match playlist resolution to the screen. Publishing performs prechecks and exposes progress/results; failed tasks can be retried. Local overlapping playlists follow schedule order, unlike the cloud calendar’s highest-priority-frame rule. ([PDF p. 22-33, Publish Playlists / Schedule Management / Publishing Center](../ViPlex-Express-User-Manual-V4.1.1.pdf#page=22))
- Automatic brightness needs a light sensor and excludes other brightness modes. Black screen leaves power on; power control requires a relay board. Sensor data also requires [logical sensor configuration (PDF pp. 75–76, Sensor Configuration)](../ViPlex-Express-User-Manual-V4.1.1.pdf#page=75). ([PDF p. 39-44, Screen Status / Power Control](../ViPlex-Express-User-Manual-V4.1.1.pdf#page=39))
- Clock sync and synchronous playback are separate. Enable synchronous playback before publishing because it changes capacity limits; GPS and RF/LoRa require installed modules. ([PDF p. 46-53, 7.5 Time Management](../ViPlex-Express-User-Manual-V4.1.1.pdf#page=46))
- Changing AP and device-login passwords together while connected over AP can disconnect the player before the second change finishes. Network probes, Wi-Fi, wired and cellular settings are separately configurable. ([PDF p. 54-58, 7.6 Network Configuration](../ViPlex-Express-User-Manual-V4.1.1.pdf#page=54))
- Fallbacks include a preset image for missing playlists and a no-Internet image only for offline webpage/stream media (Taurus V4.7.7+, at most 1920 × 1080). Simple USB copies numbered files for playback. ([PDF p. 60-61, 7.7.2 Playback Configuration](../ViPlex-Express-User-Manual-V4.1.1.pdf#page=60))
- Mosaic requires matching device models/firmware/resolutions, with at most ten screens and additional capacity limits. The TB60 ultra-long table lists 2.3 million pixels, width 23,040 and height 4096; these limits apply together. ([PDF p. 61-70, Multi-Screen Mosaic / Ultra-Long Screen Configuration](../ViPlex-Express-User-Manual-V4.1.1.pdf#page=61))
- Taurus V5.1.0+ supports VNNOX Care binding here and .vnnoxbackup configuration export/import. Diagnostic tools can export play history for up to 30 days; downgrade clears the database except screen configuration and IP parameters. ([PDF p. 64-81, Firmware Update / Cloud Server Configuration / Quick Configuration / Debugging Tool](../ViPlex-Express-User-Manual-V4.1.1.pdf#page=64))

## App implications and unknowns

The local protocol/SDK is absent. Simple USB is detailed on PDF pp. 60–61 and sensor setup on pp. 75–76. Advanced user-software/debug tools do not establish supported third-party app deployment on TB60, which the older hardware specification explicitly excludes. Confirm hardware, firmware and vendor support before exposing these operations in the app.
