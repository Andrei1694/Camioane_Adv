# NovaLCT V5.9.2 release notes

Source: [NovaLCT-Release-Notes-V5.9.2.pdf](../NovaLCT-Release-Notes-V5.9.2.pdf) Version: V5.9.2.

**Audience:** Backend, web, mobile. **Use:** Track setup-tool compatibility and support implications.

## Useful facts

- NovaLCT can find and download an NCP configuration from the cloud using a file ID or order number, then parse it locally. ([PDF p. 5-6, 2.2 Load NCP from Cloud](../NovaLCT-Release-Notes-V5.9.2.pdf#page=5))
- The newly supported devices listed here are TCC80 and N4H. The calibration addition is explicitly for TB10, TB10 Plus, TB20 and TB20 Plus, not an announcement about TB60. ([PDF p. 7-9, 2.3 Newly Supported Devices / 4.3 Calibration Function](../NovaLCT-Release-Notes-V5.9.2.pdf#page=7))
- The multimedia-player login UI now displays the default username. This is a UI improvement, not a changed app authentication protocol. ([PDF p. 9, 4.2 Multimedia Player Login](../NovaLCT-Release-Notes-V5.9.2.pdf#page=9))
- Fixes include screen readback for multiple screens, NCP decimal field-frequency parsing, and receiving-card calibration/configuration issues. ([PDF p. 10-11, 5 Bug Fixes](../NovaLCT-Release-Notes-V5.9.2.pdf#page=10))

## App implications and unknowns

Record the NovaLCT version when diagnosing installation/configuration problems. These release notes describe vendor-tool changes and expose no application API; most chip-specific changes are relevant only after the installer identifies the receiving cards.
