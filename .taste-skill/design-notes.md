# Fleet operations design

Direction: Framed sheet, seed 11042026. No redraws.

Question: Which advertising vehicles are operating, what are their LED screens showing, and what needs attention?

Face: a cool, quiet frame with teal data marks, IBM Plex Sans, and a custom LED-panel mark.
Signature: selecting a city-map vehicle connects its driver, LED screen, confirmed creative and planned campaign.

Data inventory: 12 cars; 12 fictional drivers; 12 LED screens; three active and one scheduled fictional campaign; eight broadcasting, one syncing, two offline and one standby screen; three issues; one unavailable location; a fixed 4 November 2026 14:30 Bucharest snapshot; local assignments with no device acknowledgment; derived counts from the filtered records.

Jobs: find a disconnected screen, inspect its driver and last contact, review its creative, and change a planned demo assignment. No dispatch or backend writes.

Blocks: fleet map answers where; attention queue answers what needs action; fleet list provides identity and last-known health; campaigns connect creative to assignments. The overview and object detail share one visual language; the detail is a compact side sheet instead of the dealt analytics detail blueprint, because this object has telemetry and one creative rather than time-series analytics.

All campaign artwork is original local SVG illustration. All drivers, registrations, operational readings and advertisers are sample content, not business claims. Replace the fixture dataset before connecting live operations.

Verification uses browser screenshots and DOM measurements. The bundled inspector reads console events, which repository instructions prohibit. No log collection or new test files.

## Final app-screen critique

1. The largest block is the city map; the lead number answers how many screens are broadcasting. Every requested block has its heading and first content visible at 1440 × 900. The fleet's first row begins at approximately 859px.
2. The 24px grid aligns both columns; map and attention bottoms differ by 3px and the lower panels by 5px. The phone folds navigation and shows its first fleet row at approximately 505px in an 844px viewport. All three inspected widths have no document overflow.
3. The frame is neutral, data markers carry the accent, and status marks distinguish faults. The LED mark and original ad creatives identify the product. No resting shadows or decorative motion.
4. The fixture reconciles: 8 broadcasting + 1 syncing + 2 offline + 1 standby = 12 screens; 11 drivers on shift; 4 + 4 + 3 initial campaign assignments = 11 assigned vehicles. Filters derive their counts from the same rows. Assigning an offline vehicle changes its planned creative and campaign counts while retaining its prior playback and health.
5. Standby and empty-filter views show real zeros. Missing coordinates show a dash in details and no map marker. There are three named issues, each tied to a vehicle.
6. Map legend swatches use the marker colors and only list statuses present in the filtered view. The map reserves extra bottom padding for attribution. There are no decorative charts.
7. Phone defaults to the fleet list with expandable filters and full-screen details. Native dialogs contain keyboard focus, dismiss on Escape, and restore their trigger, including map markers. Reduced-motion mode removes the sheet animation.

Remaining limits: compact geographic markers may overlap when the user zooms out; zoom and the accessible fleet list provide individual access. Fonts and map tiles require internet access. Operations remain a fixed fictional snapshot. The production build reports the existing mapping dependency's large-chunk warning.

## Verification

- Production build and Oxlint pass. Skill source lint: 0 FAIL, 0 WARN; the explicit `box-shadow: none` override is documented inline.
- Headless Chrome screenshots reviewed at 1440 × 900, 768 × 1024 and 390 × 844, including vehicle and assignment dialogs. IBM Plex Sans was loaded. DOM checks found no text below 11px or sampled dashboard text below 4.5:1 contrast.
- Verified search, screen/campaign filters, empty and zero states, map/list/detail selection, missing location, assignment save/cancel/reset, campaign counts, and persistence across navigation. Session replacement resets assignments; cross-tab logout returns to login.
- Verified map failure keeps the list usable and Retry restores markers. Verified modal keyboard containment, trigger focus restoration, folded navigation, and reduced motion.
- Verified controlled API responses for ADMIN, DRIVER, OPERATOR and USER: only verified administrators see the dashboard; other roles never request the admin user list. Admin 403 denies access, revalidation restores the dashboard, 401 clears the session, and an unavailable API offers retry. Existing Users and Route builder views remain accessible.
- API responses were intercepted only in an isolated verification browser; no production auth bypass, credentials, test files, or backend changes were added. Before and after screenshots are local ignored artifacts under `.taste-skill/qa/`.
