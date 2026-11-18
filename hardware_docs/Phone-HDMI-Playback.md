# Phone app playback through TB60 HDMI

Updated: 2026-11-11.

A single TB60 drives all three sides of the car, as confirmed by the owner. A custom phone app can supply the combined picture through HDMI, provided the phone and adapter support the required output mode. Compatibility cannot be guaranteed across all phone models.

**Our phone app → phone video output → HDMI adapter/cable → TB60 HDMI IN → LED screens**

## How playback works

The phone app downloads or streams the video, decodes it, and controls the playlist. The TB60 receives the picture in **synchronous mode**, which uses its HDMI input, and drives the configured LED panels. An internet connection is unnecessary for playing videos already downloaded to the phone.

The phone sends one combined picture. The controller's screen mapping assigns regions to the three physical screens. Showing the same advertisement everywhere requires a copy in each region; a single video spanning the whole canvas would show different portions on different sides.

Sending video over HDMI does **not** require VNNOX, NovaCloud, or the Taurus SDK. The controller still needs initial screen mapping and HDMI input selection. Programmatic brightness or controller management would be a separate integration.

Sources: [TB60 specifications, physical PDF pages 4–7](TB60-Specifications-V1.2.5.pdf#page=4), [ViPlex Express source selection, pages 36–39](ViPlex-Express-User-Manual-V4.1.1.pdf#page=36).

## Screen segments

The owner reports that the car's screens are assembled from **128 × 256 segments** (2026-11-11). The working interpretation is **128 × 256 pixels per segment**, pending confirmation of the units. This describes one building block, not the resolution of an entire screen. The installed orientation and number of segments on each side have not yet been recorded.

For a rectangular grid of identical segments with no gaps:

- With each segment **128 pixels wide × 256 pixels high**, a screen with `C` columns and `R` rows has a native resolution of **(C × 128) × (R × 256) pixels**.
- With each segment rotated to **256 pixels wide × 128 pixels high**, the resolution becomes **(C × 256) × (R × 128) pixels**.
- For example, a **1024 × 512** screen would contain **16 segments**: 8 columns × 2 rows in the first orientation, or 4 columns × 4 rows in the second. This is an illustration, not a confirmed screen size for the car.

The photographed **2304 × 512** combined canvas is mathematically compatible with this segment resolution: 18 × 2 segments, or 9 × 4 when rotated, both totaling **36 segments** if the entire canvas maps to LED pixels without unused space. This does not establish the installed segment count, the division between the three sides, or their controller mapping.

If **128 × 256** instead describes a physical size, such as millimetres, these pixel calculations do not apply; the segment's pixel resolution must be obtained separately. Physical screen dimensions cannot be inferred from a pixel count alone.

## Working ViPlex layout

The owner supplied these photos of a working ViPlex Express playlist. Positions below refer to the editor canvas; their correspondence to the car's left, right and rear screens still needs confirmation.

| Video region | X | Y | Width | Height | Photo |
| --- | ---: | ---: | ---: | ---: | --- |
| Left in editor | 0 | 0 | 1018 | 512 | [IMG_3667](evidence/viplex/left-video-region.jpg) |
| Middle in editor | 1024 | 0 | 512 | 512 | [IMG_3668](evidence/viplex/middle-video-region.jpg) |
| Right in editor | 1585 | 0 | 719 | 512 | [IMG_3669](evidence/viplex/right-video-region.jpg) |

The regions span **2304 × 512 pixels**: the rightmost edge is 1585 + 719 = 2304. This matches the apparent canvas dimensions in the window title. There are gaps of **6 pixels** and **49 pixels** between the widgets. Preserve them when reproducing this layout.

These are widget dimensions, not confirmed native panel dimensions. In particular, the widths **1018** and **719** are not multiples of 128 and therefore cannot describe the full width of a rectangular grid of complete 128 × 256-pixel segments in either orientation. Keep the photographed widget values as evidence; do not use them to infer segment counts or replace them with rounded values without checking the screen configuration. The photos show the playlist editor, not the active HDMI signal or receiving-card mapping; working ViPlex playback alone does not establish phone-to-HDMI compatibility.

## Preparing videos

For this layout, conversion can produce **one 2304 × 512 composite video** containing three copies of an advertisement, or different content in each region. Position and size each copy using the table above, leaving the gaps black. This could be automated on the backend; it is not implemented yet.

Source advertisements may be 1920 × 1080, but must be adapted to each region's aspect ratio:

- **Fit with padding:** preserve the whole image and its proportions.
- **Crop to fill:** fill the region while cutting off some content; check that logos and text remain visible.
- **Stretch:** fills the region but distorts the image; avoid this for advertisements.

**Video file dimensions and HDMI output dimensions are separate.** Playing a 2304 × 512 file does not force the phone to output that HDMI mode. A standard 1920 × 1080 signal cannot preserve the current 2304-pixel-wide arrangement pixel-for-pixel without adapting the layout or controller mapping/scaling.

## Resolution and file limits

| Item | Limit or starting choice |
| --- | --- |
| Working content canvas | **2304 × 512**, based on the supplied ViPlex photos. |
| Source video starting choice | **1920 × 1080**, at **30 or 60 fps**, before composition. This is not the confirmed HDMI output mode. |
| Documented standard HDMI input maximum | **1920 × 1200 at 60 Hz**, progressive; interlaced input is unsupported. |
| Video duration through HDMI | No TB60 HDMI-specific maximum is documented. Continuous playback depends on the phone and app. |
| Video file size through HDMI | The TB60 receives frames, not the video file. Phone storage and player capabilities determine practical limits. |
| TB60 USB file restriction | Files must be less than 4 GB for USB playback; this restriction does **not** apply to HDMI. |
| Upload through our backend | Default **100 MiB** per file (104,857,600 bytes), unless overridden by `UPLOAD_MAX_FILE_SIZE_BYTES`. |
| Backend configuration ceiling | Currently **2,147,483,647 bytes**, or 2 GiB minus one byte. No maximum video duration is currently enforced. |

The TB60's advertised 4K decoding capability applies to onboard playback; it does not establish standard 4K HDMI input support. Its custom EDID dimensions range from 512 to 4096 on each axis, with a documented custom-resolution pixel-clock ceiling of 153 MHz. **2304 × 512 is a candidate custom HDMI mode to test**, subject to phone/adapter support, timing and installed firmware. Alternatively, a standard output mode needs a validated layout and mapping/scaling configuration.

Sources: [TB60 HDMI and USB limits, page 7](TB60-Specifications-V1.2.5.pdf#page=7), [backend upload configuration](../backend/src/config/files.ts), [backend upload behavior](../backend/README.md#uploaded-files).

## Phone app requirements

- Maintain a tested list of phone models and adapters. A USB-C connector alone does not establish video-output support. See [Apple display compatibility](https://support.apple.com/en-us/105099) and [Samsung wired display compatibility](https://www.samsung.com/us/support/answer/ANS10001955/).
- Show the advertisement on the external display and controls on the phone. Android provides the [Presentation API](https://developer.android.com/reference/android/app/Presentation). Our Expo app will likely need native integration and a [custom development/production build](https://docs.expo.dev/workflow/customizing/).
- Plan charging, heat management, playback recovery and content caching. For an initial implementation, downloading before playback avoids dependence on cellular reception; the existing backend does not implement HTTP range playback.
- Define playback behavior when the driver's session expires. The [current mobile app](../mobile/README.md#sign-in-and-sessions) signs out after its one-hour access token expires.

## First hardware check

1. Confirm the segment units and installed orientation, then record the segment columns, rows and native pixel dimensions for each side. Read the existing NovaLCT screen connection configuration to verify which canvas region reaches each side and whether any canvas areas are unused. Preserve a configuration backup before changes.
2. Check **ViPlex → Monitor & Control → Current Source → HDMI EDID/Scaling**, installed firmware and the phone/adapter's supported output modes.
3. Send a labelled test picture through the actual phone-to-HDMI connection. Verify all three regions, proportions and edges before playing converted advertisements.
4. Check charging, extended playback, phone locking, incoming calls, session expiry, app restarts and HDMI disconnection/reconnection.

ViPlex documents an HDMI Preferred mode, but recovery from a frozen phone app must be tested separately from loss of the HDMI signal. The actual vehicle installation has not yet been validated for this setup.
