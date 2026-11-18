# Taurus synchronous playback

Source: [Taurus-Synchronous-Playback-Implementation-Instructions-V1.6.7.pdf](../Taurus-Synchronous-Playback-Implementation-Instructions-V1.6.7.pdf) Version: V1.6.7 (2022-09-05).

**Audience:** Backend, web, mobile. **Use:** Understand coordinated playback across several players.

## Useful facts

- This is synchronization of internally stored content across players in asynchronous mode, not the HDMI input mode. ([PDF p. 4, 1 Overview](../Taurus-Synchronous-Playback-Implementation-Instructions-V1.6.7.pdf#page=4))
- All players must support and enable synchronization, share synchronized clocks, and receive the same playback plan without random media or transitions. ([PDF p. 4, Requirements of Synchronous Playback](../Taurus-Synchronous-Playback-Implementation-Instructions-V1.6.7.pdf#page=4))
- The table groups TB60 with T30/T50/T60 and TB30/TB40/TB50. It says not to mix platforms; this edition’s multi-page scenario allows one 1080p image/video per page, with matching media properties. ([PDF p. 4-5, Specifications of Synchronous Playback](../Taurus-Synchronous-Playback-Implementation-Instructions-V1.6.7.pdf#page=4))
- NTP can use a local server or a public server. LAN setup uses ViPlex Handy/Express; remote setup uses VNNOX and requires cloud binding. ([PDF p. 6-9, 2 How to Implement NTP Synchronization](../Taurus-Synchronous-Playback-Implementation-Instructions-V1.6.7.pdf#page=6))
- RF requires a purchased module per player and a shared group ID. A group has one master used only as the time reference, not to drive a screen; slave players drive screens. ([PDF p. 10-15, 3 How to Implement RF Synchronization](../Taurus-Synchronous-Playback-Implementation-Instructions-V1.6.7.pdf#page=10))
- GPS requires the appropriate cellular/GPS hardware; the example uses an EC20 module and SIM. Configuration is described through ViPlex Express or VNNOX Standard. ([PDF p. 16-19, 4 How to Implement GPS Synchronization](../Taurus-Synchronous-Playback-Implementation-Instructions-V1.6.7.pdf#page=16))

## App implications and unknowns

Treat this 2022 procedure as a compatibility constraint to verify, not a latency or frame-lock guarantee. Its single-1080p scenario differs from the newer TB60 capacity descriptions. The guide supplies vendor-tool procedures, not a local SDK contract; GPS clock synchronization alone does not establish a vehicle-location API.
