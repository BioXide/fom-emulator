# PACKET_ID (PACKET_ID <0x0E>)

## Summary
- Brief description of the packet

## Field Table
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | msgId | u8 | raw | 0xFE |
| 0x01 | token | string | StringCompressor | Shared secret to gate discovery |

## Notes
- Must use the same discovery token configured on master/world.
