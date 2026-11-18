# TB60 specifications V1.2.5

Source: [TB60-Specifications-V1.2.5.pdf](../TB60-Specifications-V1.2.5.pdf) Version: V1.2.5 (2026-08-31).

**Audience:** Backend, web, mobile. **Use:** Constrain media preparation and device setup.

## Useful facts

- Loading capacity is 2,300,000 pixels, with ordinary width/height limits of 4096 each and custom-resolution pixel clock no higher than 153 MHz. A separate ultra-long mode lists width up to 23,040 pixels and refers to another configuration guide. ([PDF p. 3, Features](../TB60-Specifications-V1.2.5.pdf#page=3))
- The device has 1 GB RAM and 32 GB storage. This edition lists simultaneous playback of 1 × 4K, 2 × 1080p, 5 × 720p, 6 × 480p or 6 × 360p; videos between 2K and 4K count as 4K. ([PDF p. 4, Performance](../TB60-Specifications-V1.2.5.pdf#page=4))
- H.264: 64 × 64 through 4096 × 2304, 30 fps, ideal-case 80 Mbps, MP4/AVI/MKV/MOV. H.265: the same size range, 60 fps, ideal-case 100 Mbps, MP4/MKV/MOV. ([PDF p. 11, Media Decoding Specifications](../TB60-Specifications-V1.2.5.pdf#page=11))
- JPG/JPEG, BMP, PNG and WEBP are bounded at 64 × 64 through 4096 × 2304; GIF reaches 1920 × 1088 with frame-rate restrictions. The JPEG “interlaced scan only” wording needs confirmation with sample files. ([PDF p. 10-11, Media Decoding Specifications](../TB60-Specifications-V1.2.5.pdf#page=10))
- Internal content is asynchronous mode; HDMI input is synchronous mode. Multi-screen synchronous playback is a separate feature that halves simultaneous video capacity and requires NTP, GPS or RF time synchronization. ([PDF p. 5, Functionality](../TB60-Specifications-V1.2.5.pdf#page=5))
- Wi-Fi AP and STA may operate together. AP naming is Model plus the last eight serial-number digits. This edition specifies wired > Wi-Fi > 4G priority; a 4G module is purchased separately. ([PDF p. 5, Functionality](../TB60-Specifications-V1.2.5.pdf#page=5))
- USB playback/storage supports FAT32/NTFS on 2–128 GB drives; each file must be greater than 0 KB and less than 4 GB. HDMI custom EDID dimensions are 512–4096; exact scaling limits are delegated to another guide. ([PDF p. 7, Appearance](../TB60-Specifications-V1.2.5.pdf#page=7))
- Internet connectivity and VNNOX connectivity have different indicator states. Brightness and environmental sensing require connected sensors; GPS/RF synchronization requires specified optional modules. ([PDF p. 4-8, Input / Functionality / Indicators](../TB60-Specifications-V1.2.5.pdf#page=4))

## App implications and unknowns

Compared with [V1.1.0](TB60-Specifications-V1.1.0.md), this edition reduces playback counts and H.264 frame rate, changes USB support and contradicts its network-coexistence wording. Installed firmware, usable free storage, actual screen geometry, optional modules, and the referenced ultra-long/scaling guides remain unconfirmed.
