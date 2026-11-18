# VNNOX Standard V7.2.0

Source: [VNNOX-Standard-User-Manual-V7.2.0.pdf](../VNNOX-Standard-User-Manual-V7.2.0.pdf) Version: V7.2.0 (filename).

**Audience:** Backend, web, mobile. **Use:** Understand cloud publishing, scheduling, tracking and control constraints.

## Useful facts

- Bind screens by serial number or ViPlex tools and provide Internet connectivity. Devices can remain pending activation when offline; server node and player authentication must match. ([PDF p. 9-16, Screen Binding](../VNNOX-Standard-User-Manual-V7.2.0.pdf#page=9))
- GPS/track history requires a 4G module; without it the map shows the binding address. Track history covers seven days. The manual also includes media-server and splicing-screen management. ([PDF p. 23-27, Screen Map / Media Server List / Splicing Screen Management](../VNNOX-Standard-User-Manual-V7.2.0.pdf#page=23))
- Cloud storage is listed as 5 GB. Uploads below 48 × 48 are rejected and those above 4096 × 2304 require transcoding. Deleting a referenced media item blocks publishing. ([PDF p. 28-30, Uploading Media](../VNNOX-Standard-User-Manual-V7.2.0.pdf#page=28))
- Solutions contain ordered pages with validity dates and time slots. Overlapping page slots play in page order. Intelligent tag-matched solutions cannot be included in schedules. ([PDF p. 30-33, Creating Solutions](../VNNOX-Standard-User-Manual-V7.2.0.pdf#page=30))
- Offline publishing waits for reconnection. Resolution mismatches can stretch content. Calendar schedules allow a non-repeating date only today or in the following seven days; overlapping time frames select the highest priority. ([PDF p. 34-40, Publishing Solutions / Scheduling Solutions / Publishing Schedules](../VNNOX-Standard-User-Manual-V7.2.0.pdf#page=34))
- Location targeting uses circles/polygons and area-list order for overlaps. [Playback Management (PDF p. 52)](../VNNOX-Standard-User-Manual-V7.2.0.pdf#page=52) can enable location targeting so matching geographic solutions play first, or disable it to play common solutions only. ([PDF p. 36-38, Location Targeting / Scheduling Solutions](../VNNOX-Standard-User-Manual-V7.2.0.pdf#page=36))
- Blackout leaves power on; screen power uses relays. Player On/Off scheduling is NS2K-only. Clock synchronization, coordinated playback and HDMI source selection are separate controls. ([PDF p. 44-54, Player Control](../VNNOX-Standard-User-Manual-V7.2.0.pdf#page=44))
- UI log searches cover at most 30 days in the past three months: overview results above 50 screens are emailed, and detailed searches allow 25 screens. Media approval can gate publishing. ([PDF p. 56-57, Play Logs / Media Approval](../VNNOX-Standard-User-Manual-V7.2.0.pdf#page=56))
- Appendix recommendations include H.264 for 4K and below, 24/25/30 fps, about 8 Mbps for 1080p and 35–45 Mbps for 4K, with video size <3G. These are recommendations, not the TB60’s complete hard limits. ([PDF p. 59, Media Types Supported by VNNOX](../VNNOX-Standard-User-Manual-V7.2.0.pdf#page=59))

## App implications and unknowns

The location-targeting toggle is detailed on [PDF p. 52, Playback Management](../VNNOX-Standard-User-Manual-V7.2.0.pdf#page=52); its public API and exact device requirements still need confirmation. Unlike [V7.50.0](VNNOX-Standard-User-Manual-V7.50.0.md), this edition describes emailing overview reports above 50 screens. Use the API extracts for implementation rather than assuming every UI feature has an endpoint.
