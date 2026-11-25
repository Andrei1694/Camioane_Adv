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

## Measured physical screen sizes

The owner measured the car's screens in centimetres (2026-11-19):

| Screen | Height (cm) | Width (cm) |
| --- | ---: | ---: |
| Back | 200 | 200 |
| Left | 200 | 400 |
| Right | 200 | 300 |

The owner gave these as height × width for the back screen; the left and right sizes are read the same way (all three are 200 cm high). Confirm this reading if it matters.

These are physical dimensions, not pixel resolutions. They also fit the ViPlex editor regions below when the 512-pixel height is taken as 200 cm: the widths scale to roughly 2.4–2.6 pixels per cm (left 1018 ÷ 400 ≈ 2.5, back/middle 512 ÷ 200 = 2.56, right 719 ÷ 300 ≈ 2.4). So the editor's left, middle and right regions likely correspond to the **left (400 cm), back (200 cm) and right (300 cm)** screens. This is an inference from the proportions, not a confirmed mapping, and the pixel density is not exactly uniform.

### Hypothesis: native panel sizes of 1024, 512 and 768 pixels wide

At the height-derived density of 2.56 px/cm (512 px ÷ 200 cm), the measured widths predict:

| Screen | Width (cm) | Predicted width (px) | Editor widget (px) |
| --- | ---: | ---: | ---: |
| Left | 400 | 1024 | 1018 |
| Back | 200 | 512 | 512 |
| Right | 300 | 768 | 719 |

The predicted widths are all multiples of 128, which the widget widths 1018 and 719 are not. They also sum to 1024 + 512 + 768 = **2304**, the editor canvas width, with no gaps. The editor's 6 px and 49 px gaps would then come from widgets sized by hand inside slightly larger regions, and the left and right widgets would be slightly narrower than their real panels.

The two candidate layouts side by side (all 512 px high):

| | Version A: photographed widgets | Version B: hypothesis |
| --- | --- | --- |
| Left | x 0, width 1018 | x 0, width 1024 |
| Back (middle in editor) | x 1024, width 512 | x 1024, width 512 |
| Right | x 1585, width 719 | x 1536, width 768 |
| Gaps | 6 px and 49 px | none |
| Canvas | 2304 × 512 | 2304 × 512 |
| Widths multiples of 128 | no (1018, 719) | yes (1024, 512, 768) |
| Segments (128 × 256), left / back / right | cannot be a full grid | 8 × 2 / 4 × 2 / 6 × 2 = 36 |
| Status | evidence from ViPlex photos | inferred from measured cm sizes, unconfirmed |

This is a hypothesis, not a measurement. Confirm it from the receiving-card or screen configuration (NovaLCT or ViPlex) before changing the layout in `frontend/src/pages/ScreenVideoPage/screenLayout.ts` or the mobile app, and keep the photographed widget values as evidence until then. If it holds, each screen is 128 × 256 segments in a grid: 8 × 2, 4 × 2 and 6 × 2 segments (16, 8 and 12, 36 in total, matching the 36 segments computed above for 2304 × 512).

## Photos of the car (2026-11-19)

The owner photographed the car's screens at an auto-wash while testing video and measuring with a tape. **ViPlex was not used for these tests**: the video came from our phone app over HDMI into the TB60, so the [ViPlex layout](#working-viplex-layout) below does not apply to them. The app fits the video inside whatever HDMI mode the phone negotiates and centres it (`videoGravity = .resizeAspect` on iOS, `RESIZE_MODE_FIT` on Android); the TB60's screen configuration then decides which part of that HDMI frame reaches each panel. The files are in [evidence/truck](evidence/truck/), renamed from the original WhatsApp names. The descriptions below only say what each photo shows; the numbers on the tape are legible in the photos but are not transcribed here.

| Photo | Shows |
| --- | --- |
| [01](evidence/truck/01-side-rear-phone-mirror.jpeg) | Side and rear screens showing the phone's own interface (a share and an edit button, "You on 19/11/2026, 00:25") with visible glitching. It looks like system screen mirroring rather than the app's player, which shows only the video. |
| [02](evidence/truck/02-side-rear-open-cabinet.jpeg) | Side and rear screens with a video playing only in the lower part. The rear cabinet door is open, showing a black tank inside. |
| [03](evidence/truck/03-side-rear-lower-band.jpeg), [04](evidence/truck/04-side-rear-large-video.jpeg) | Side and rear screens with a video lit only in a lower band. The upper part is dark. |
| [05](evidence/truck/05-rear-head-on.jpeg) | Rear screen head-on. The video fills only the lower left, with a dark area above and to the right. |
| [06](evidence/truck/06-side-rear-test-blocks.jpeg) | Side and rear corner with two lit blocks in the lower half and a dark gap between them. |
| [07](evidence/truck/07-rear-white-margin-test.jpeg) | Rear screen head-on with a tape against the right block. The large lit block reads "WHITE MARGIN TEST \| 1920 x 1080", with a narrower block to its right, both only in the lower part. |
| [08](evidence/truck/08-tape-vertical-lit-area.jpeg), [09](evidence/truck/09-tape-vertical-bottom-edge.jpeg) | A vertical tape along the lit area's height, and a close-up of its lower end at the panel's bottom frame. |
| [10](evidence/truck/10-tape-horizontal-lit-edge.jpeg), [11](evidence/truck/11-tape-horizontal-panel-edge.jpeg), [12](evidence/truck/12-tape-across-dark-gap.jpeg), [13](evidence/truck/13-tape-narrow-strip-edge.jpeg) | Horizontal tape measurements across lit and dark areas and near the panel frame. Photo 11 also shows the tank behind the open cabinet. |
| [14](evidence/truck/14-led-pixel-closeup-tape.jpeg) | Close-up of the LED pixels with a tape, usable for reading the pixel pitch. |
| [15](evidence/truck/15-tape-dark-square.jpeg) | A person measuring a dark square inside a lit area, along the panel's lower edge. |
| [Video 1](evidence/truck/16-video-1.mp4), [video 2](evidence/truck/17-video-2.mp4) | 576 × 1024 (about 28 s) and 832 × 464 (about 12 s). I have not reviewed their content. |

What the photos suggest, none of it confirmed:

- **The phone-to-HDMI path reaches the screens.** Both the phone's mirrored interface (01) and test videos (02–07) appear on the panels.
- **Only the lower part of each screen is lit.** On the rear screen the lit region is roughly 40–45% of the screen's height, and the vertical tape in photos 08 and 09 appears to read in the mid-80s of centimetres, against 200 cm for the screen.
- **Cause, as reported by the owner: the mobile app offsets the video wrongly.** Both HDMI players fit the video inside the HDMI frame and centre it (`videoGravity = .resizeAspect` in `mobile/modules/hdmi-player/ios/HdmiSceneDelegate.swift`, `RESIZE_MODE_FIT` in `HdmiPlayerModule.kt`). A 2304 × 512 file in a 1920 × 1080 mode is scaled to 1920 × 427 and starts about 327 rows down, leaving the top of the frame black. If the TB60 takes the screens' rows from the top of the HDMI frame, only the bottom of each screen shows video: about 185 of 512 rows (36%), close to but below the 40–45% measured. The negotiated HDMI mode was not recorded, so the exact numbers are unconfirmed.
- **The horizontal offsets are also unverified for HDMI.** The editor places its copies at x = 0, 1024 and 1585 (from the ViPlex photos), and `contain` centres each copy inside its region. ViPlex was not involved in HDMI playback, so these positions do not necessarily match where the TB60 reads each physical screen from the HDMI frame.
- **Rear screen layout (photo 07, estimated from the photo).** A large lit block about 150 × 85–89 cm, about 16:9, labelled "WHITE MARGIN TEST | 1920 x 1080"; a dark gap of about 16 cm; and a narrow lit block about 32 cm wide. Together they span the screen's full width, bottom-aligned.
- **Test video.** The "WHITE MARGIN TEST" video is not one of the app's bundled samples (`flower.mp4` is 960 × 540 and `truck_screen.mp4` is 2304 × 512), so it was picked from the phone. The negotiated HDMI mode during the test was not recorded.
- **Pixel pitch.** The close-up in photo 14 suggests an LED spacing of about 4 mm by eye, consistent with 2.56 px/cm (P3.91, where a 128 × 256 px segment is 50 × 100 cm). The dots have not been counted.

A poster for the AUR "Trenul Unirii" event (1 December 2026) from the same day is kept in [evidence/creative](evidence/creative/trenul-unirii-poster.jpeg). It is advertising content, not a hardware photo.

## Working ViPlex layout

The owner supplied these photos of a working ViPlex Express playlist. Positions below refer to the editor canvas; their correspondence to the car's left, right and rear screens still needs confirmation (the [measured sizes](#measured-physical-screen-sizes) suggest left, back, right in that order).

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
