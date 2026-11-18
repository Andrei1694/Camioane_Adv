# NovaStar hardware and integration documentation

Official references for TB60 players, LED screen configuration, content publishing and the NovaCloud API. Start with the TB60 specifications for media limits, NovaLCT for physical screen setup, and the [API index](api/README.md) for application integration.

For app implementation, use the [developer takeaways index](developer/README.md): short, source-linked notes for the backend, web dashboard and mobile team, covering every vendor document and API page.

For playback from our own phone app, see [Phone app playback through TB60 HDMI](Phone-HDMI-Playback.md): the confirmed single-controller setup, photographed ViPlex layout, video conversion, phone compatibility, file limits and pending HDMI checks.

The owner reports that the car's screens are built from **128 × 256 segments** (2026-11-11). See [screen segments](Phone-HDMI-Playback.md#screen-segments) for the working pixel interpretation, grid calculations and remaining checks on units, orientation and segment counts per side.

The additions below were retrieved on **2026-11-10**. Original vendor files are preserved without rewriting their content. Three PDFs were extracted from official documentation bundles; installers and firmware binaries are not included.

## Manuals and release notes

| Document | Version | Purpose | Official source | Retrieved |
| --- | --- | --- | --- | --- |
| [TB60 Multimedia Player Specifications](TB60-Specifications-V1.2.5.pdf) | V1.2.5 | Updated hardware connections, performance and media decoding limits. | [PDF](https://en-website001.oss-us-east-1.aliyuncs.com/Specification/TB60%20Multimedia%20Player%20Specifications-V1.2.5.pdf) | 2026-11-10 |
| [Taurus Series Multimedia Players Quick Start Guide](Taurus-Quick-Start-Guide-3rd-Generation-V1.0.2.pdf) | V1.0.2 | Initial connections, required software and device login. | [PDF](https://oss.novastar.tech/uploads/2023/11/Taurus-Series-Multimedia-Players-Quick-Start-Guide-3rd-Generation-V1.0.2.pdf) | 2026-11-10 |
| [Taurus Synchronous Playback Implementation Instructions](Taurus-Synchronous-Playback-Implementation-Instructions-V1.6.7.pdf) | V1.6.7 | Configuration and requirements for synchronising multiple players. | [PDF](https://oss.novastar.tech/uploads/2022/09/Taurus-Series-Multimedia-Players-Synchronous-Playback-Implementation-Instructions-V1.6.7.pdf) | 2026-11-10 |
| [NovaLCT LED Configuration Tool for Multimedia Player User Manual](NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf) | V5.9.2 | Screen and receiving-card setup, calibration, monitoring and maintenance. | [PDF](https://en-website001.oss-us-east-1.aliyuncs.com/Specification/NovaLCT%20LED%20Configuration%20Tool%20for%20Multimedia%20Player%20User%20Manual-V5.9.2.pdf) | 2026-11-10 |
| [NovaLCT Release Notes](NovaLCT-Release-Notes-V5.9.2.pdf) | V5.9.2 | Software changes and compatibility information. | [PDF](https://en-website001.oss-us-east-1.aliyuncs.com/Specification/NovaLCT%20V5.9.2%20Release%20Notes.pdf) | 2026-11-10 |
| [ViPlex Express User Manual](ViPlex-Express-User-Manual-V4.1.1.pdf) | V4.1.1 | Desktop playlists, scheduling, device configuration and publishing. | [PDF bundle](https://download.vnnox.com/vnnox_software/ViPlexExpress_User_Manual_EN.zip) | 2026-11-10 |
| [ViPlex Handy User Manual](ViPlex-Handy-User-Manual-V6.0.0.pdf) | V6.0.0 | Mobile screen management and local or cloud publishing. | [PDF](https://en-website001.oss-us-east-1.aliyuncs.com/Specification/ViPlex%20Handy%20User%20Manual%20-V6.0.0.pdf) | 2026-11-10 |
| [VNNOX Standard User Manual](VNNOX-Standard-User-Manual-V7.2.0.pdf) | V7.2.0 | Cloud content publishing, scheduling, remote control and playback reporting. | [PDF bundle](https://download.vnnox.com/vnnox_software/VNNOX%20User%20Manual.zip) | 2026-11-10 |
| [VNNOX System Management User Manual](VNNOX-System-Management-User-Manual-V1.1.0.pdf) | V1.1.0 | Cloud organisation, users, roles and resource permissions. | [PDF bundle](https://download.vnnox.com/vnnox_software/VNNOX%20User%20Manual.zip) | 2026-11-10 |
| [Taurus Firmware Release Notes](Taurus-Firmware-Release-Notes-V5.1.0.txt) | V5.1.0 | Firmware changes and required NovaLCT, ViPlex and VNNOX Care versions. | [Text](https://en-website001.oss-us-east-1.aliyuncs.com/Specification/T30T50TB30TB40TB50TB60.txt) | 2026-11-10 |

The quick-start guide is a single fold-out PDF sheet with text stored as artwork. It was checked visually and is readable, but text search and extraction are unavailable in the original file.

Keep documentation matched to the installed hardware and software. The truck hardware revisions and installed firmware versions have not been recorded here. Existing document editions remain available below for comparison; version labels are reproduced from the supplied filenames.

## NovaCloud API references

The [local API index](api/README.md) covers **74 Markdown pages** downloaded from the [official English index](https://developer-en.vnnox.com/llms.txt), including access and authentication, player management, publishing and schedules, real-time and scheduled control, playback reports, notifications, device monitoring, and schemas.

These are unversioned documentation snapshots retrieved on 2026-11-10; they do not establish which API permissions or optional hardware features are enabled for a particular account or device. The original [vendor index](api/llms.txt) retains its online links. The local index provides offline links and identifies navigation-only and embedded-schema pages.

## Existing documents

These five repository files were preserved byte-for-byte. Their original download URLs and retrieval dates were not recorded, so they are not assigned the retrieval date of the new downloads.

| Document | Version | Purpose | Original source and retrieval date |
| --- | --- | --- | --- |
| [TB60 Specifications](TB60-Specifications-V1.1.0.pdf) | V1.1.0 | Hardware connections, features and media limits. | Not recorded |
| [ViPlex Express User Manual](ViPlex-Express-User-Manual-V4.0.0.pdf) | V4.0.0 | Desktop playlists and device management. | Not recorded |
| [ViPlex Handy User Manual](ViPlex-Handy-User-Manual-V4.4.0.pdf) | V4.4.0 | Mobile screen management. | Not recorded |
| [VNNOX Standard User Manual](VNNOX-Standard-User-Manual-V7.1.1-official.pdf) | V7.1.1 | Cloud publishing, scheduling and player control. | Not recorded |
| [VNNOX Standard User Manual](VNNOX-Standard-User-Manual-V7.50.0.pdf) | V7.50.0 | Cloud publishing and remote player control. | Not recorded |

## Verification and provenance

- PDF signatures and end markers, page structure and document titles were checked. Available text was extracted throughout eight PDFs; the artwork-only quick-start sheet and pages without extractable text were checked from rendered previews.
- All 74 Markdown links in the official API index were retrieved. API and schema exports contain specification blocks; embedded schema references resolve to downloaded schema pages.
- SHA-256 hashes were checked against the five original PDFs and across the downloaded files. No duplicate file content was found.
- [sources.json](sources.json) records source URLs, versions, retrieval dates, file sizes, SHA-256 hashes and archive-member names where applicable. It also records the original files with unknown source dates explicitly left empty.
- Unavailable public references: none from the selected download list or API index at the retrieval date.

## Supplier-dependent documents

| Needed document | Obtain from | Information to request |
| --- | --- | --- |
| Taurus local-control T-SDK and protocol documentation | NovaStar or the equipment supplier | TB60 compatibility, supported platforms, licensing, integration documentation and sample projects. The [official download page](https://en-source.vnnox.com/download) lists T-SDK under secondary development with a Contact Us action. |
| Truck electrical and installation drawings | Truck or screen installer | Power distribution, supply models, cooling, cable routing, mounting, shutdown and service procedures. |
| Screen and receiving-card configuration backups | Screen supplier or installer | Confirm the reported 128 × 256 segment units, pixel resolution, orientation and columns/rows per side; obtain exact screen pixel dimensions, receiving-card models, port and cabinet mapping, configuration files and calibration data for each truck. |
| Cellular module or router documentation | Equipment supplier after identifying the installed model | Module model, supported network bands, SIM/APN setup, antennas, reconnection behaviour and GPS access if location tracking is required. |

These installation-specific documents are not supplied by the general manuals above. No vendor contact or account registration was performed.
