# NovaLCT multimedia-player configuration V5.9.2

Source: [NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf) Version: V5.9.2 (filename).

**Audience:** Backend, web, mobile. **Use:** Understand installer-owned prerequisites behind reliable playback and monitoring.

## Useful facts

- NovaLCT is a Windows configuration tool. It sends settings over Ethernet/Wi-Fi after device login; available functions depend on hardware and firmware. ([PDF p. 4-10, Software Introduction / Device Connection / User Login](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf#page=4))
- Screen configuration maps actual receiving cards, output ports, cabinet dimensions and starting coordinates. Multiple ports may serve one screen; the mapping must match physical installation. ([PDF p. 27-30, 5.2.2 Connect Screen](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf#page=27))
- Sending settings and saving them to hardware are distinct actions. Persistent configuration should be saved; the tool can read back existing hardware settings and export backups. ([PDF p. 25-31, NCP Management / Connect Screen / Save Configuration Files](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf#page=25))
- Configuration formats differ: receiving-card .rcfgx/.rcfg or model-specific .ncp, screen connection .scr, local system .scfg and cloud bundles including version data. NCP must match the receiving-card model ([PDF p. 24, Configuration through NCP](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf#page=24)); backup file types are detailed on [PDF p. 31, Save Configuration Files](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf#page=31). ([PDF p. 11-13, Load Configuration Files / Configuration through RCFG](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf#page=11))
- TB60/T60 device and Ethernet-port redundancy require the corresponding physical connections and configuration. Backup status is distinct from a failed/offline card. ([PDF p. 33-35, 5.3 Set Redundancy](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf#page=33))
- VNNOX Care monitoring registration requires a Care account and Internet on the control PC. Offline-screen backups can be registered later. Registration enables automatic refresh/linking; older player firmware can require upgrading. ([PDF p. 74-79, 7.1 Register Screens with VNNOX Care](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf#page=74))
- Temperature, voltage, fan, smoke and module monitoring depend on specific receiving/monitoring cards, smart modules and sensors. Refresh intervals and alarm thresholds are configurable. ([PDF p. 79-85, 7.2 View and Configure Monitoring / 7.3 Configure Module Monitoring](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf#page=79))
- Multifunction-card power uses configured relays. Screen status can independently be Normal, Black Out or Freeze. Receiving-card runtime is resettable and is not advertisement playback history. ([PDF p. 85-93, 8 Screen Management](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf#page=85))
- “No Screen” may mean absent or unread configuration rather than a disconnected player; reading back or completing screen configuration is the documented remedy. ([PDF p. 116-117, 12.2.1 No Screen displayed in NovaLCT](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf#page=116))

## App implications and unknowns

Obtain the real screen dimensions, receiving-card models, topology and configuration/calibration backups from the installer. Keep calibration and chip setup in the installer workflow. This manual supplies no app API. Its smart-module applicability statements in monitoring (pp. 79–85) and [LED error detection (PDF p. 100)](../NovaLCT-Multimedia-Player-User-Manual-V5.9.2.pdf#page=100) differ; confirm the specific feature/hardware instead of assuming blanket support. NCP requirements and backup formats are detailed on pp. 24–31.
