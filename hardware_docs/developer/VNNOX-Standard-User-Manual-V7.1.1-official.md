# VNNOX Standard V7.1.1

Source: [VNNOX-Standard-User-Manual-V7.1.1-official.pdf](../VNNOX-Standard-User-Manual-V7.1.1-official.pdf) Version: V7.1.1 (filename); original source date unknown.

**Audience:** Backend, web, mobile. **Use:** Connect screen onboarding, schedules and location-based advertising.

## Useful facts

- Screen binding supports a device serial number or ViPlex tools; network configuration and Internet activation are prerequisites. Credentials are obtained from the device label and cloud authentication settings. ([PDF p. 9-16, Screen Binding / Adding Screens](../VNNOX-Standard-User-Manual-V7.1.1-official.pdf#page=9))
- Live GPS and track history require a 4G module. Without one, the shown location is the address reported at binding. Track history covers the past seven days. ([PDF p. 22-24, Screen Map](../VNNOX-Standard-User-Manual-V7.1.1-official.pdf#page=22))
- The cloud media library is listed as 5 GB. Uploads below 48 × 48 are rejected; media above 4096 × 2304 requires transcoding. Deleting a referenced media item prevents publishing its solution. ([PDF p. 25-27, Uploading Media](../VNNOX-Standard-User-Manual-V7.1.1-official.pdf#page=25))
- Solutions have ordered pages and per-page validity/time slots. Intelligent tag matching auto-publishes regular solutions to matching screens, but such solutions cannot be added to schedules. ([PDF p. 27-30, Creating Solutions](../VNNOX-Standard-User-Manual-V7.1.1-official.pdf#page=27))
- Publishing to offline players is deferred until they reconnect. Resolution mismatches may stretch content; a published request is not proof of playback. ([PDF p. 31-35, Publishing Solutions / Publishing Schedules](../VNNOX-Standard-User-Manual-V7.1.1-official.pdf#page=31))
- For calendar schedules, “Never” plays only today or within the next seven days. Overlapping time frames play only the highest-priority frame; this differs from ordered overlapping pages. ([PDF p. 34-35, Scheduling Solutions](../VNNOX-Standard-User-Manual-V7.1.1-official.pdf#page=34))
- Location targeting associates content with circles/polygons. Overlapping geographic areas follow area-list order and repeat their associated content. ([PDF p. 36-37, Location Targeting](../VNNOX-Standard-User-Manual-V7.1.1-official.pdf#page=36))
- Blackout does not cut power. Relay power control differs from player On/Off scheduling, which this manual restricts to NS2K products. Synchronization requires consistent time, device and solution settings. ([PDF p. 43-50, Player Control](../VNNOX-Standard-User-Manual-V7.1.1-official.pdf#page=43))
- UI playback reports cover up to 30 days within three months. Overviews above 50 screens are emailed; details allow up to 25 screens. Media approval, when enabled, gates solution use. ([PDF p. 53-54, Play Logs / Media Approval](../VNNOX-Standard-User-Manual-V7.1.1-official.pdf#page=53))

## App implications and unknowns

These are VNNOX UI behaviors, not complete public API contracts. Confirm location/track API availability and installed modules before promising fleet tracking or geofencing. Additional media-server/splicing-management material appears in [V7.2.0](VNNOX-Standard-User-Manual-V7.2.0.md); review its own page references when comparing behavior.
