# Hardware documentation for app developers

Short extracts for the backend, web dashboard and mobile team. **89 notes cover 14 PDFs, one firmware release file and all 74 vendor API pages.** Filenames and the `api/` directory mirror their sources; PDF/TXT extensions become `.md`. The four navigation/provenance files are accounted for below without duplicate extracts.

Use the notes to find implementation constraints, then follow their source links for detailed fields, schemas and procedures. “Useful facts” describes the cited source; “App implications and unknowns” contains recommendations and unresolved dependencies. PDF citations use **physical, one-based PDF pages**, including covers, rather than printed page labels.

These notes use the local snapshots only. API pages were retrieved on **2026-11-10** and have no established service-release version; exported OpenAPI `info.version: 1.0.0` does not identify installed firmware. Older manual provenance is preserved in [sources.json](../sources.json). Each edition is treated separately; a larger filename version does not settle conflicting limits.

## Start here

- **Vehicle installation:** [screen segments and phone-to-HDMI playback](../Phone-HDMI-Playback.md#screen-segments) records the owner-reported 128 × 256 segments, the working pixel interpretation, and the photographed content layout. Confirm units, orientation and segment counts per side before using them as native screen dimensions.
- **Backend:** [API access and signing](api/doc-4696857.md), [normal publishing](api/api-180502121.md), [playback detail exports](api/api-189311783.md), and [cloud onboarding](api/api-446386210.md).
- **Web dashboard:** [VNNOX publishing and schedules](VNNOX-Standard-User-Manual-V7.2.0.md), [permissions](VNNOX-System-Management-User-Manual-V1.1.0.md), [scheduled controls](api/api-285406451.md), and [Care screen monitoring](api/api-262298538.md).
- **Mobile:** [quick start](Taurus-Quick-Start-Guide-3rd-Generation-V1.0.2.md), [ViPlex Handy](ViPlex-Handy-User-Manual-V6.0.0.md), and [device runtime status](api/api-186309730.md).
- **Shared constraints:** compare [TB60 V1.1.0](TB60-Specifications-V1.1.0.md) with [V1.2.5](TB60-Specifications-V1.2.5.md), then check [firmware prerequisites](Taurus-Firmware-Release-Notes-V5.1.0.md) and [synchronous playback](Taurus-Synchronous-Playback-Implementation-Instructions-V1.6.7.md).

## Integration boundaries

Cloud APIs document publishing, controls, callbacks and reporting. ViPlex/NovaLCT manuals also describe local workflows, but the supplier’s Taurus local-control SDK/protocol is not included. Vendor-software features such as automatic transcoding, geographic targeting and local discovery must not be assumed to have an equivalent downloaded API.

Installed firmware, exact screen geometry, optional cellular/GPS/RF/sensor/camera hardware, account region and permissions remain unknown. Command acceptance, media download, actual playback and physical screen visibility are different states. Notes flag conflicts such as TB60 decoding limits, scheduling payload types, notification content and onboarding response shapes rather than silently selecting one interpretation.

## Manuals and firmware — 15 sources

| Source | Developer extract | Audience | Purpose |
| --- | --- | --- | --- |
| [NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf) | [NovaLCT multimedia-player configuration V5.9.2](NovaLCT-Multimedia-Player-User-Manual-V5.9.2.md) | Backend, web, mobile | Understand installer-owned prerequisites behind reliable playback and monitoring. |
| [NovaLCT-Release-Notes-V5.9.2.pdf](../NovaLCT-Release-Notes-V5.9.2.pdf) | [NovaLCT V5.9.2 release notes](NovaLCT-Release-Notes-V5.9.2.md) | Backend, web, mobile | Track setup-tool compatibility and support implications. |
| [TB60-Specifications-V1.1.0.pdf](../TB60-Specifications-V1.1.0.pdf) | [TB60 specifications V1.1.0](TB60-Specifications-V1.1.0.md) | Backend, web, mobile | Understand this edition’s device and media limits. |
| [TB60-Specifications-V1.2.5.pdf](../TB60-Specifications-V1.2.5.pdf) | [TB60 specifications V1.2.5](TB60-Specifications-V1.2.5.md) | Backend, web, mobile | Constrain media preparation and device setup. |
| [Taurus-Firmware-Release-Notes-V5.1.0.txt](../Taurus-Firmware-Release-Notes-V5.1.0.txt) | [Taurus firmware V5.1.0](Taurus-Firmware-Release-Notes-V5.1.0.md) | Backend, web, mobile | Identify firmware-dependent features and companion software. |
| [Taurus-Quick-Start-Guide-3rd-Generation-V1.0.2.pdf](../Taurus-Quick-Start-Guide-3rd-Generation-V1.0.2.pdf) | [Taurus third-generation quick start](Taurus-Quick-Start-Guide-3rd-Generation-V1.0.2.md) | Mobile, web, backend | Identify the onboarding tools and network prerequisites. |
| [Taurus-Synchronous-Playback-Implementation-Instructions-V1.6.7.pdf](../Taurus-Synchronous-Playback-Implementation-Instructions-V1.6.7.pdf) | [Taurus synchronous playback](Taurus-Synchronous-Playback-Implementation-Instructions-V1.6.7.md) | Backend, web, mobile | Understand coordinated playback across several players. |
| [VNNOX-Standard-User-Manual-V7.1.1-official.pdf](../VNNOX-Standard-User-Manual-V7.1.1-official.pdf) | [VNNOX Standard V7.1.1](VNNOX-Standard-User-Manual-V7.1.1-official.md) | Backend, web, mobile | Connect screen onboarding, schedules and location-based advertising. |
| [VNNOX-Standard-User-Manual-V7.2.0.pdf](../VNNOX-Standard-User-Manual-V7.2.0.pdf) | [VNNOX Standard V7.2.0](VNNOX-Standard-User-Manual-V7.2.0.md) | Backend, web, mobile | Understand cloud publishing, scheduling, tracking and control constraints. |
| [VNNOX-Standard-User-Manual-V7.50.0.pdf](../VNNOX-Standard-User-Manual-V7.50.0.pdf) | [VNNOX Standard V7.50.0](VNNOX-Standard-User-Manual-V7.50.0.md) | Backend, web, mobile | Understand this edition’s cloud publishing workflow. |
| [VNNOX-System-Management-User-Manual-V1.1.0.pdf](../VNNOX-System-Management-User-Manual-V1.1.0.pdf) | [VNNOX system management](VNNOX-System-Management-User-Manual-V1.1.0.md) | Backend, web, mobile | Understand cloud account and resource permissions. |
| [ViPlex-Express-User-Manual-V4.0.0.pdf](../ViPlex-Express-User-Manual-V4.0.0.pdf) | [ViPlex Express V4.0.0](ViPlex-Express-User-Manual-V4.0.0.md) | Mobile, backend, web | Understand Windows-based local publishing and support workflows. |
| [ViPlex-Express-User-Manual-V4.1.1.pdf](../ViPlex-Express-User-Manual-V4.1.1.pdf) | [ViPlex Express V4.1.1](ViPlex-Express-User-Manual-V4.1.1.md) | Mobile, backend, web | Understand local commissioning, media delivery and firmware-dependent features. |
| [ViPlex-Handy-User-Manual-V4.4.0.pdf](../ViPlex-Handy-User-Manual-V4.4.0.pdf) | [ViPlex Handy V4.4.0](ViPlex-Handy-User-Manual-V4.4.0.md) | Mobile, backend, web | Understand older mobile local/cloud workflows and setup limits. |
| [ViPlex-Handy-User-Manual-V6.0.0.pdf](../ViPlex-Handy-User-Manual-V6.0.0.pdf) | [ViPlex Handy V6.0.0](ViPlex-Handy-User-Manual-V6.0.0.md) | Mobile, backend, web | Understand current-snapshot mobile setup, publishing and device capability checks. |

## API access and location codes — 3 sources

| Source | Developer extract | Audience | Purpose |
| --- | --- | --- | --- |
| [api/doc-4696857.md](../api/doc-4696857.md) | [API Access Guide](api/doc-4696857.md) | Backend, web, mobile | Establish NovaCloud access, authentication and request limits. |
| [api/doc-4696860.md](../api/doc-4696860.md) | [Common HTTP Status Codes](api/doc-4696860.md) | Backend, web, mobile | Interpret shared HTTP failures without confusing them with player results. |
| [api/doc-4696871.md](../api/doc-4696871.md) | [Notes](api/doc-4696871.md) | Backend, web, mobile | Interpret hardware position and alarm location codes. |

## Player onboarding and status — 4 sources

| Source | Developer extract | Audience | Purpose |
| --- | --- | --- | --- |
| [api/api-180498654.md](../api/api-180498654.md) | [Obtain player list](api/api-180498654.md) | Backend, web, mobile | Discover cloud players and map trucks to player IDs. |
| [api/api-180498661.md](../api/api-180498661.md) | [Obtaining Basic Player Information](api/api-180498661.md) | Backend, web, mobile | Read cloud online status and basic identity. |
| [api/api-186309730.md](../api/api-186309730.md) | [Obtaining Player Configuration Status](api/api-186309730.md) | Backend, web, mobile | Read current player settings asynchronously. |
| [api/api-446386210.md](../api/api-446386210.md) | [Add Player](api/api-446386210.md) | Backend, web, mobile | Add players to a cloud account using serial numbers. |

## Publishing and media checks — 6 sources

| Source | Developer extract | Audience | Purpose |
| --- | --- | --- | --- |
| [api/api-180502121.md](../api/api-180502121.md) | [Common Solutions](api/api-180502121.md) | Backend, web, mobile | Publish a normal multi-page solution. |
| [api/api-180502122.md](../api/api-180502122.md) | [Single-Page Emergency Insertion Solutions](api/api-180502122.md) | Backend, web, mobile | Insert an emergency single-page solution. |
| [api/api-180502123.md](../api/api-180502123.md) | [Canceling Emergency Insertion Solutions](api/api-180502123.md) | Backend, web, mobile | Cancel the currently playing emergency insertion. |
| [api/api-277397809.md](../api/api-277397809.md) | [Offline Export](api/api-277397809.md) | Backend, web, mobile | Export an offline program in Nova playback protocol. |
| [api/api-277399402.md](../api/api-277399402.md) | [Over-specification Detection Switching](api/api-277399402.md) | Backend, web, mobile | Enable or disable player over-specification detection. |
| [api/api-277411236.md](../api/api-277411236.md) | [Program Over-specification Detection](api/api-277411236.md) | Backend, web, mobile | Check a program against target player specifications. |

## Immediate controls — 9 sources

| Source | Developer extract | Audience | Purpose |
| --- | --- | --- | --- |
| [api/api-180498655.md](../api/api-180498655.md) | [Brightness Adjustment](api/api-180498655.md) | Backend, web, mobile | Set player brightness immediately. |
| [api/api-180498656.md](../api/api-180498656.md) | [Volume Adjustment](api/api-180498656.md) | Backend, web, mobile | Set player volume immediately. |
| [api/api-180498657.md](../api/api-180498657.md) | [Video Source Switching](api/api-180498657.md) | Backend, web, mobile | Switch between internal playback and an external video source. |
| [api/api-180498658.md](../api/api-180498658.md) | [Screen Status](api/api-180498658.md) | Backend, web, mobile | Switch between normal display and blackout. |
| [api/api-180498659.md](../api/api-180498659.md) | [Restart Players](api/api-180498659.md) | Backend, web, mobile | Restart selected players. |
| [api/api-180498660.md](../api/api-180498660.md) | [Screen Power](api/api-180498660.md) | Backend, web, mobile | Switch configured screen power outputs. |
| [api/api-180502118.md](../api/api-180502118.md) | [NTP Time Synchronization](api/api-180502118.md) | Backend, web, mobile | Enable or disable NTP clock synchronization. |
| [api/api-180502119.md](../api/api-180502119.md) | [Synchronous playback](api/api-180502119.md) | Backend, web, mobile | Enable or disable synchronous playback. |
| [api/api-180502120.md](../api/api-180502120.md) | [Screenshots](api/api-180502120.md) | Backend, web, mobile | Request a screenshot from selected players. |

## Scheduled controls — 5 sources

| Source | Developer extract | Audience | Purpose |
| --- | --- | --- | --- |
| [api/api-285406451.md](../api/api-285406451.md) | [Scheduled Screen Status](api/api-285406451.md) | Backend, web, mobile | Schedule normal display and blackout. |
| [api/api-285484784.md](../api/api-285484784.md) | [Scheduled Restart Players](api/api-285484784.md) | Backend, web, mobile | Schedule player restarts. |
| [api/api-285492978.md](../api/api-285492978.md) | [Scheduled Volume Adjustment](api/api-285492978.md) | Backend, web, mobile | Schedule player volume changes. |
| [api/api-285501603.md](../api/api-285501603.md) | [Scheduled Brightness Adjustment](api/api-285501603.md) | Backend, web, mobile | Schedule fixed or sensor-driven brightness. |
| [api/api-285704459.md](../api/api-285704459.md) | [Scheduled Video Source Switching](api/api-285704459.md) | Backend, web, mobile | Schedule internal/external video-source switching. |

## Reports, notifications and account handoff — 9 sources

| Source | Developer extract | Audience | Purpose |
| --- | --- | --- | --- |
| [api/api-186379152.md](../api/api-186379152.md) | [Video Source Change Notifications](api/api-186379152.md) | Backend, web, mobile | Register notifications for internal/external video-source changes. |
| [api/api-186380851.md](../api/api-186380851.md) | [Solution Change Notifications](api/api-186380851.md) | Backend, web, mobile | Register the endpoint labeled solution-change notifications. |
| [api/api-186383461.md](../api/api-186383461.md) | [Obtaining Control Command Execution Logs](api/api-186383461.md) | Backend, web | Read control-command execution history for one player. |
| [api/api-186409405.md](../api/api-186409405.md) | [Obtaining User List](api/api-186409405.md) | Backend, web | List cloud users and their accessible VNNOX subsystems. |
| [api/api-186409414.md](../api/api-186409414.md) | [Obtaining Login URL](api/api-186409414.md) | Backend, web, mobile | Obtain a temporary URL for access to VNNOX. |
| [api/api-188119325.md](../api/api-188119325.md) | [Batch Searching for Play Log Overviews](api/api-188119325.md) | Backend, web | Request batch playback overview reports. |
| [api/api-188120581.md](../api/api-188120581.md) | [Searching for the Play Log Detail of a Single Player](api/api-188120581.md) | Backend, web | Request single-player playback detail reports. |
| [api/api-189311783.md](../api/api-189311783.md) | [Batch Searching for Play Log Details](api/api-189311783.md) | Backend, web | Request batch playback detail reports. |
| [api/api-189316709.md](../api/api-189316709.md) | [Searching for the Play Log Overview of a Single Player](api/api-189316709.md) | Backend, web | Request single-player playback overview reports. |

## Care monitoring — 19 sources

| Source | Developer extract | Audience | Purpose |
| --- | --- | --- | --- |
| [api/api-181820138.md](../api/api-181820138.md) | [Receiving cards — basic information](api/api-181820138.md) | Backend, web, mobile | Identify receiving cards attached to a device. |
| [api/api-181820139.md](../api/api-181820139.md) | [Receiving cards — monitoring](api/api-181820139.md) | Backend, web, mobile | Read receiving-card health, temperature and voltage. |
| [api/api-181820140.md](../api/api-181820140.md) | [Receiving cards — alarms](api/api-181820140.md) | Backend, web, mobile | Read receiving cards alarms. |
| [api/api-181820141.md](../api/api-181820141.md) | [Screen — monitoring](api/api-181820141.md) | Backend, web, mobile | Read screen dimensions and brightness. |
| [api/api-181820142.md](../api/api-181820142.md) | [Controller — basic information](api/api-181820142.md) | Backend, web, mobile | Read controller identity, software and health. |
| [api/api-181820143.md](../api/api-181820143.md) | [Controller — alarms](api/api-181820143.md) | Backend, web, mobile | Read controller alarms. |
| [api/api-188113043.md](../api/api-188113043.md) | [Controller — operating parameters](api/api-188113043.md) | Backend, web, mobile | Read controller operating settings and resources. |
| [api/api-188113524.md](../api/api-188113524.md) | [Smart modules — monitoring](api/api-188113524.md) | Backend, web, mobile | Read smart-module health and attached module metadata. |
| [api/api-188114426.md](../api/api-188114426.md) | [Smart modules — alarms](api/api-188114426.md) | Backend, web, mobile | Read smart modules alarms. |
| [api/api-188114676.md](../api/api-188114676.md) | [Input source — monitoring](api/api-188114676.md) | Backend, web | Read input-source computer resource information. |
| [api/api-188115020.md](../api/api-188115020.md) | [Modules and cabinets — monitoring](api/api-188115020.md) | Backend, web | Read module/cabinet configuration metadata. |
| [api/api-198265532.md](../api/api-198265532.md) | [Receiving cards — topology](api/api-198265532.md) | Backend, web | Read receiving-card topology and Ethernet redundancy. |
| [api/api-198267779.md](../api/api-198267779.md) | [Brightness History](api/api-198267779.md) | Backend, web | Read brightness adjustment history. |
| [api/api-198270522.md](../api/api-198270522.md) | [Monitoring cards — monitoring](api/api-198270522.md) | Backend, web, mobile | Read monitoring-card sensor and cabinet status. |
| [api/api-262298538.md](../api/api-262298538.md) | [Screen list](api/api-262298538.md) | Backend, web, mobile | Discover screens registered for Care monitoring. |
| [api/api-289009793.md](../api/api-289009793.md) | [Screen detail](api/api-289009793.md) | Backend, web, mobile | Read aggregate Care details for multiple screens. |
| [api/api-293155189.md](../api/api-293155189.md) | [Camera configuration](api/api-293155189.md) | Backend, web | Change an existing monitoring camera configuration. |
| [api/api-293155525.md](../api/api-293155525.md) | [The camera monitors the aggregated information](api/api-293155525.md) | Backend, web, mobile | Read monitoring-camera images for selected screens. |
| [api/api-341731719.md](../api/api-341731719.md) | [Monitoring cards — alarms](api/api-341731719.md) | Backend, web, mobile | Read monitoring cards alarms. |

## Widget examples, navigation and schemas — 19 sources

| Source | Developer extract | Audience | Purpose |
| --- | --- | --- | --- |
| [api/doc-6506467.md](../api/doc-6506467.md) | [Hand-drawn clock widget](api/doc-6506467.md) | Backend, web, mobile | Find the publishing example for a drawn digital clock. |
| [api/doc-6506699.md](../api/doc-6506699.md) | [Weather widget](api/doc-6506699.md) | Backend, web, mobile | Find the simple-weather publishing example. |
| [api/doc-6507057.md](../api/doc-6507057.md) | [Environmental Monitoring widget](api/doc-6507057.md) | Backend, web, mobile | Find the environmental-sensor widget publishing example. |
| [api/doc-7691702.md](../api/doc-7691702.md) | [Text component](api/doc-7691702.md) | Backend, web, mobile | Navigate to the text component schema. |
| [api/doc-7691703.md](../api/doc-7691703.md) | [RSS component](api/doc-7691703.md) | Backend, web, mobile | Navigate to the rss component schema. |
| [api/doc-7691704.md](../api/doc-7691704.md) | [WEATHER — Simple Weather Component](api/doc-7691704.md) | Backend, web, mobile | Navigate to the weather — simple weather component schema. |
| [api/doc-7691705.md](../api/doc-7691705.md) | [ANALOG_WEATHER — Basic Weather Component](api/doc-7691705.md) | Backend, web, mobile | Navigate to the analog_weather — basic weather component schema. |
| [api/doc-7691712.md](../api/doc-7691712.md) | [Advanced-weather schema wrapper](api/doc-7691712.md) | Backend, web, mobile | Navigate to the advanced-weather schema wrapper schema. |
| [api/folder-53325354.md](../api/folder-53325354.md) | [Program components](api/folder-53325354.md) | Backend, web, mobile | Locate component documentation without inventing an API. |
| [api/schema-156550829.md](../api/schema-156550829.md) | [Hand drawn digital clock](api/schema-156550829.md) | Backend, web, mobile | Implement an optional clock widget with explicit time formatting. |
| [api/schema-161188704.md](../api/schema-161188704.md) | [Scheduled plan item](api/schema-161188704.md) | Backend, web, mobile | Share date/time rules across scheduled player controls. |
| [api/schema-161429769.md](../api/schema-161429769.md) | [Environmental Monitoring item](api/schema-161429769.md) | Backend, web, mobile | Describe optional environmental readings on the player display. |
| [api/schema-161525226.md](../api/schema-161525226.md) | [Solution widgets base](api/schema-161525226.md) | Backend, web, mobile | Reuse shared layout/media fields when composing solutions. |
| [api/schema-162442578.md](../api/schema-162442578.md) | [Player Common Solution](api/schema-162442578.md) | Backend, web, mobile | Structure normal solutions, page schedules and typed widgets. |
| [api/schema-220230730.md](../api/schema-220230730.md) | [Text component](api/schema-220230730.md) | Backend, web, mobile | Support formatted text with static, scrolling or paged display. |
| [api/schema-220235090.md](../api/schema-220235090.md) | [RSS component](api/schema-220235090.md) | Backend, web, mobile | Configure an RSS feed widget. |
| [api/schema-220236771.md](../api/schema-220236771.md) | [WEATHER - Simple Weather Component](api/schema-220236771.md) | Backend, web, mobile | Configure the simple weather widget. |
| [api/schema-220244495.md](../api/schema-220244495.md) | [ANALOG_WEATHER - Basic Weather Component](api/schema-220244495.md) | Backend, web, mobile | Configure the basic graphical weather widget. |
| [api/schema-220247740.md](../api/schema-220247740.md) | [ADVANCED_WEATHER - Advanced Weather Component](api/schema-220247740.md) | Backend, web, mobile | Configure the advanced weather widget and its regional limits. |

## Existing navigation and provenance — 4 files

| Source | Extract | Audience | Purpose |
| --- | --- | --- | --- |
| [hardware_docs/README.md](../README.md) | Use original | All | Source catalog, download context and supplier-dependent documents; now links to this developer index. |
| [hardware_docs/sources.json](../sources.json) | Use original | All | File provenance, versions, retrieval dates, source URLs and SHA-256 hashes. No behavioral contract to summarize. |
| [hardware_docs/api/README.md](../api/README.md) | Use original | All | Offline API catalog and mapping of embedded schema references. |
| [hardware_docs/api/llms.txt](../api/llms.txt) | Use original | All | Original vendor navigation index with online links; the tables above provide local extract links. |

## Review and verification

The full local source content was reviewed, including each manual edition and API schemas/examples. The artwork-only quick-start sheet and relevant media, synchronization, capability and permissions tables/diagrams were inspected visually. Remote image assets referenced by API Markdown are not part of the local snapshots and were not used to infer extra capabilities.

Coverage, local links, PDF page bounds and retained limits were checked. All original vendor files and provenance/API navigation files remain unchanged; the only existing-file edit is the developer-index link in the parent README. No application code or configuration was changed, and no application tests or runtime logs were used.
