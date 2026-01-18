# SMSG_PACKETGROUP (0x0E)

## Summary
- Server -> client packet that bundles multiple LithTech submessages.
- Bit-packed (LSB bit order) inside RakNet internal payload.

## Field Table (raw Rak frame)
Offsets below reflect the **observed 134‑byte packetgroup capture**. The payload start can shift when the Rak internal header changes.
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | rakMessageId | u8 | raw | 0x40 (RakNet internal packet) |
| 0x01–0x68 | rakHeader | bytes | raw | Rak internal header (variable length/bit‑aligned) |
| 0x69 | msgId | u8 | BitStream (LSB) | 0x0E (payload[0] after Rak unwrap) |
| 0x6A | subLenBits_0 | u8 | BitStream (LSB) | Length in **bits**, includes subMsgId; 0 terminates |
| 0x6B | subMsgId_0 | u8 | BitStream (LSB) | LithTech submessage ID |
| 0x6C–0x80 | subPayload_0 | bits | BitStream (LSB) | `subLenBits_0 - 8` bits (observed through 0x80) |
| 0x81 | subLenBits_1 | u8 | BitStream (LSB) | Next submessage length (bits) |
| 0x82 | subMsgId_1 | u8 | BitStream (LSB) | Next LithTech submessage ID |
| 0x83–0x?? | subPayload_1 | bits | BitStream (LSB) | `subLenBits_1 - 8` bits |

## Notes
- `subLenBits` is **bit-count**, not bytes. Max 255 bits (~31.875 bytes).
- Common bundled IDs: SMSG_NETPROTOCOLVERSION (0x04), SMSG_YOURID (0x0C),
  SMSG_CLIENTOBJECTID (0x07), SMSG_LOADWORLD (0x06).
- Constraints referenced in `Docs/Notes/Server_MMO_Engineering_Plan.md`.
