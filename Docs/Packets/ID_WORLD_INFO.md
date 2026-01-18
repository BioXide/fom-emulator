# ID_WORLD_INFO (0xFF)

## Summary
- Direction: world -> master
- Purpose: discovery response with authoritative worldId + endpoint

## Field Table
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | msgId | u8 | raw | 0xFF |
| 0x01 | token | string | StringCompressor | Echoed token to bind response |
| 0x.. | worldId | u32 | compressed | World identifier |
| 0x.. | worldIp | u32 | compressed | IPv4 LE encoding |
| 0x.. | worldPort | u16 | compressed | World UDP port |

## Read/Write (decomp)
- Write: server emulator `IdWorldInfoPacket.encode()`
- Read: server emulator `IdWorldInfoPacket.decode()`

## IDA Anchors
- n/a (server-only packet)

## Validation
- server: verified 01/12/26

## Notes
- Master should ignore responses with invalid token or unknown sender.

