# ID_CONNECTION_REQUEST (0x04)

## Summary
- Direction: client -> server
- Purpose: RakNet connection request (offline handshake)

## Field Table
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | msgId | u8 | raw | 0x04 |
| 0x01 | offlineId | u8[16] | raw | Constant per RakNet 3.611 |
| 0x11 | rakNetGuid | u8[16] | raw | From client |
| 0x21 | password | bytes | raw | `RakPeer::Connect` password |

## Read/Write (decomp)
- Write: RakNet 3.611 `RakPeer::Connect` send path (`Server\\packagers\\networking\\native\\raknet\\src\\RakPeer.cpp`)
- Read: RakNet 3.611 `ParseConnectionRequestPacket`

## IDA Anchors
- ida: pending (RakNet in `fom_client.exe` not yet mapped)
- ida2: n/a

## Validation
- ida: pending
- ida2: n/a
- Source of truth: `Server\\packagers\\networking\\native\\raknet\\src\\RakPeer.cpp`

## Notes / Edge Cases
- In FoM, world connect uses password `37eG87Ph`.

