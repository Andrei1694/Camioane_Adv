# VNNOX system management

Source: [VNNOX-System-Management-User-Manual-V1.1.0.pdf](../VNNOX-System-Management-User-Manual-V1.1.0.pdf) Version: V1.1.0 (filename).

**Audience:** Backend, web, mobile. **Use:** Understand cloud account and resource permissions.

## Useful facts

- Accounts select a regional server node. VNNOX generates player authentication information for binding terminals; this is distinct from the Open Platform API access key. ([PDF p. 3-6, 1 Registration and Login / Screen Authentication](../VNNOX-System-Management-User-Manual-V1.1.0.pdf#page=3))
- Roles grant functionality permissions; workgroups constrain data access. A user belongs to one workgroup and may have multiple roles. ([PDF p. 8-11, 3 Organization Structure / Users / Roles](../VNNOX-System-Management-User-Manual-V1.1.0.pdf#page=8))
- Users can modify their workgroup and descendants’ resources; resources shared from other groups are view/use only. Only the system administrator modifies public-workgroup resources. ([PDF p. 12-14, Workgroups](../VNNOX-System-Management-User-Manual-V1.1.0.pdf#page=12))
- Disabling an application clears its role permissions. Role setup depends on which of VNNOX Standard, AD and Care are enabled. ([PDF p. 15, Application Configuration](../VNNOX-System-Management-User-Manual-V1.1.0.pdf#page=15))
- When media approval is enabled, pending/rejected media cannot be added to solutions. Approved media can be published; approver auto-approval does not retroactively approve earlier uploads. ([PDF p. 15-17, Advanced Function](../VNNOX-System-Management-User-Manual-V1.1.0.pdf#page=15))
- VNNOX login history can be filtered over the latest 90 days, with an eight-day default. This is account access history, not proof that an ad played. ([PDF p. 20, 5 Log Management](../VNNOX-System-Management-User-Manual-V1.1.0.pdf#page=20))

## App implications and unknowns

Map the app’s users and roles to the intended vendor account/workgroup deliberately; the two permission systems are not automatically equivalent. These are vendor UI capabilities, not evidence that the downloaded APIs implement user administration or approval. Confirm enabled services and API permissions independently.
