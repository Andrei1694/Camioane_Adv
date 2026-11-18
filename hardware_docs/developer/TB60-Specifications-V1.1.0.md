# TB60 specifications V1.1.0

Source: [TB60-Specifications-V1.1.0.pdf](../TB60-Specifications-V1.1.0.pdf) Version: V1.1.0 (2024-05-30).

**Audience:** Backend, web, mobile. **Use:** Understand this edition’s device and media limits.

## Useful facts

- The screen loading limit is 2,300,000 pixels; maximum width and height are each 4096 pixels. These are separate constraints, not permission for a 4096 × 4096 screen. ([PDF p. 3, Features](../TB60-Specifications-V1.1.0.pdf#page=3))
- This edition lists 1 GB RAM, 32 GB storage and simultaneous playback of 2 × 4K, 6 × 1080p, 10 × 720p or 20 × 360p videos. Synchronous playback halves decoding capability. ([PDF p. 4, Performance / Functionality](../TB60-Specifications-V1.1.0.pdf#page=4))
- H.264 is listed up to 4096 × 2304 at 60 fps / 80 Mbps; H.265 up to the same resolution at 60 fps / 100 Mbps. Bitrates are ideal-case maxima. Containers and codec profiles also matter. ([PDF p. 9, Media Decoding Specifications](../TB60-Specifications-V1.1.0.pdf#page=9))
- The image table lists JPG/JPEG, BMP, GIF, PNG and WEBP. Its unusual JPEG limit, “817×8176”, and scan wording should be verified before becoming validation rules. ([PDF p. 9, Media Decoding Specifications](../TB60-Specifications-V1.1.0.pdf#page=9))
- Asynchronous mode uses internal content; synchronous mode uses HDMI. HDMI input/output are listed up to 1920 × 1200 at 60 Hz. The documented full-screen scaling is downscaling only, with additional source-size constraints. ([PDF p. 4-6, Functionality / Appearance](../TB60-Specifications-V1.1.0.pdf#page=4))
- Local access uses Ethernet, USB Type-B or Wi-Fi AP/STA. This edition gives the AP name as AP plus the last eight serial-number digits; its password is on the device label. ([PDF p. 3-6, Control / Functionality / Appearance](../TB60-Specifications-V1.1.0.pdf#page=3))
- 4G/5G modules are optional. GPS and RF synchronization need specified modules. This edition says networks coexist on firmware V4.5.0 or later; older firmware prioritizes wired, then Wi-Fi, then cellular. ([PDF p. 4, Functionality](../TB60-Specifications-V1.1.0.pdf#page=4))
- USB storage is documented as Ext4/FAT32, with a FAT32 single-file maximum of 4 GB; exFAT/FAT16 are unsupported. Third-party applications on the player are explicitly unsupported. ([PDF p. 6-8, Appearance / Specifications](../TB60-Specifications-V1.1.0.pdf#page=6))

## App implications and unknowns

Use this as edition-specific evidence. [V1.2.5](TB60-Specifications-V1.2.5.md) changes playback counts, H.264 limits, USB formats and network wording. Confirm the actual device/firmware and test representative media before selecting limits; do not plan to install the Expo app on the player.
