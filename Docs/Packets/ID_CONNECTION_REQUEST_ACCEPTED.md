# ID_CONNECTION_REQUEST_ACCEPTED (0x0E)

## Summary
- Direction: server -> client
- Purpose: RakNet connection accept (promotes to CONNECTED)

## Field Table
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | msgId | u8 | raw | 0x0E |
| 0x01 | externalId | SystemAddress | raw | Server-reported external addr |
| 0x.. | systemIndex | SystemIndex | raw | |
| 0x.. | internalIds | SystemAddress[] | raw | Array length from RakNet |

## Read/Write (decomp)
- Write: RakNet 3.611 `SendConnectionRequestAccepted` (`Server\\packagers\\networking\\native\\raknet\\src\\RakPeer.cpp`)
- Read: RakNet 3.611 parse path (reads externalId + systemIndex + internalIds)

## IDA Anchors
- ida: parse path disasm around `0x004F63FE` (reads SystemAddress, then systemIndex, then internal IDs); connectMode=CONNECTED write at `0x004F6419`
- ida2: n/a

## Validation
- ida: partial 01/05/26 (disasm)
- ida2: n/a
- Source of truth: `Server\\packagers\\networking\\native\\raknet\\src\\RakPeer.cpp`

## Notes / Edge Cases
- Client connectMode flips to CONNECTED after acceptance.

