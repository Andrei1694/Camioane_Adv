# ViPlex Express V4.0.0

Source: [ViPlex-Express-User-Manual-V4.0.0.pdf](../ViPlex-Express-User-Manual-V4.0.0.pdf) Version: V4.0.0 (filename); original source date unknown.

**Audience:** Mobile, backend, web. **Use:** Understand Windows-based local publishing and support workflows.

## Useful facts

- Async mode stores playlists on the player for scheduled playback. Demo mode offers virtual screens; this version does not support Studio mode. ([PDF p. 4-5, 1 Software Description](../ViPlex-Express-User-Manual-V4.0.0.pdf#page=4))
- Local discovery uses LAN scanning or an IP/range. This edition describes the default static address 192.168.0.10 for Taurus V4.7.7+ and requires the PC on the same subnet; login uses the device-label password. ([PDF p. 7-10, Hardware Connection / Screen Management](../ViPlex-Express-User-Manual-V4.0.0.pdf#page=7))
- Playlists contain ordered pages; publishing checks compatibility and warns about resolution mismatches. The publishing center separates waiting, in-progress, succeeded and failed tasks. ([PDF p. 16-26, Playlist Management / Schedule Management / Publishing Center](../ViPlex-Express-User-Manual-V4.0.0.pdf#page=16))
- USB export requires the device login password. Plug-and-play requires the drive to remain connected; copy-and-play copies content locally and allows removing it. [Simple USB Playback (PDF pp. 51–52, Basic Configuration)](../ViPlex-Express-User-Manual-V4.0.0.pdf#page=51) is a separate passwordless mode for image/video files. ([PDF p. 14-15, 4.4 USB Playback](../ViPlex-Express-User-Manual-V4.0.0.pdf#page=14))
- Automatic brightness requires a light sensor; only one brightness mode is active at a time. Black-screen control leaves power on, while screen power requires a relay board. ([PDF p. 31-35, Screen Status / Power Control](../ViPlex-Express-User-Manual-V4.0.0.pdf#page=31))
- Synchronized playback requires clock sync and a separate playback switch, which changes playback limits. NTP, GPS and RF/LoRa have different network/module requirements. ([PDF p. 37-44, 7.5 Time Management](../ViPlex-Express-User-Manual-V4.0.0.pdf#page=37))
- The no-Internet image applies specifically to offline webpage/stream media on Taurus V4.7.7+: JPG/JPEG/PNG/BMP, maximum 1920 × 1080. It is not a replacement for every lost network connection. ([PDF p. 51, 7.7.2 Basic Configuration](../ViPlex-Express-User-Manual-V4.0.0.pdf#page=51))
- This edition routes TB60 ultra-long content up to 16,368 pixels wide through ViPlex Express and points to a separate guide above that. Cloud publishing binding and monitoring-binding information are separate. ([PDF p. 56-58, Ultra-Long Screen Configuration / Cloud Server Configuration](../ViPlex-Express-User-Manual-V4.0.0.pdf#page=56))
- Upgrades from below V2.3.0 need an intermediate V2.3.0 step. Downgrading clears the device database while retaining screen configuration and IP parameters. ([PDF p. 63-65, 8.1 Device Upgrade](../ViPlex-Express-User-Manual-V4.0.0.pdf#page=63))

## App implications and unknowns

Use vendor software for these documented local workflows until supplier SDK/protocol support is confirmed. Simple USB details are on PDF pp. 51–52. [V4.1.1](ViPlex-Express-User-Manual-V4.1.1.md) adds explicit Taurus V5.1.0 setup/backup features and different ultra-long-screen guidance; do not merge their limits.
