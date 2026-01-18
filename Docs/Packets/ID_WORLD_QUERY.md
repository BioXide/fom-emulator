# ID_WORLD_QUERY (0xFE)

## Summary
- Direction: master -> world
- Purpose: discovery probe to retrieve authoritative worldId + endpoint from a world server

## Field Table
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | msgId | u8 | raw | 0xFE |
| 0x01 | token | string | StringCompressor | Shared secret to gate discovery |

## Read/Write (decomp)
- Write: server emulator `IdWorldQueryPacket.encode()`
- Read: server emulator `IdWorldQueryPacket.decode()`

## IDA Anchors
- n/a (server-only packet)

## Validation
- server: verified 01/12/26

## Notes
- Must use the same discovery token configured on master/world.

