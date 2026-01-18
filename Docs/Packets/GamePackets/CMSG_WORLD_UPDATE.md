# CMSG_WORLD_UPDATE (0x19)

## Summary
- Client -> server movement/update stream (the 86‑byte pcaps with `... 1f e0 19 00 00 ...`).
- Bit-packed (LSB bit order) inside RakNet internal payload.
- `payload[0]` is **RakNet internalPacket->data[0]** (after `ReliabilityLayer::CreateInternalPacketFromBitStream` parses the internal header).
- Raw byte offsets vary per packet; **do not** key off raw offsets like `0x16` or payload content heuristics.
- This document replaces the prior 0x0A assumption; 0x0A is **SMSG_UNGUARANTEEDUPDATE (S→C)** and documented separately.

## Field Table (raw Rak frame)
Offsets below reflect the **observed 86‑byte movement packets** (byte‑aligned in these captures). The payload start can shift when the Rak internal header changes.
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | rakMessageId | u8 | raw | 0x40 (RakNet internal packet) |
| 0x01–0x15 | rakHeader | bytes | raw | Rak internal header (variable length/bit‑aligned) |
| 0x16 | msgId | u8 | BitStream (LSB) | 0x19 (payload[0] after Rak unwrap) |
| 0x17–0x1A | worldInst | u32c | BitStream (LSB) | Observed `00 00 00 00` in samples |
| 0x1B–0x1E | sequence | u32c | BitStream (LSB) | Observed `00 e8 04 38` / `00 e8 06 d8` |
| 0x1F | entryType | u8c | BitStream (LSB) | Observed `0x7e` in samples |
| 0x20–0x23 | netId | u32c | BitStream (LSB) | Observed `88 77 54 20` |
| 0x24–0x34 | position + yaw | struct | BitStream (LSB) | `CompactVec3` (s16 + yaw), observed bytes `50 3b aa 10 29 13 c0 00 00 00 03 83 fe 4f 0b 40 76` |
| 0x35–0x4A | profile | struct | BitStream (LSB) | `Appearance.encode()` (observed bytes through `00 3f`) |
| 0x4B | skipOptionalBlock | bit | BitStream (LSB) | Observed `0x8d` (bit‑packed; next fields follow) |
| 0x4C–0x54 | optional block | block | BitStream (LSB) | Observed `88 81 6a 00 00 64 00 00 00` |
| 0x55 | terminator | u8c | BitStream (LSB) | Observed `0x40` in samples |

## Packet Capture
Length: 88 bytes
```
0000  40 00 00 00 00 7d 1a 4f 80 00 00 29 98 80 00 00  |@....}.O...)....|
0010  1f 80 00 00 20 c0 19 00 00 00 00 01 f4 69 3d 7e  |.... ........i=~|
0020  88 78 0b 4a e8 3b c8 94 a6 24 3c 00 00 00 00 20  |.x.J.;...$<.... |
0030  6b 80 17 8b ec a8 3a 1d 80 00 00 00 00 00 01 51  |k.....:........Q|
0040  41 02 4b 0a 09 2c 00 1d 20 36 29 a2 00 0f e3 62  |A.K..,.. 6)....b|
0050  20 66 01 90 00 00 01 00                          | f......|
```

## Notes
- Movement pcaps (86 bytes) show `... 1f e0 19 00 00 ...` where the `0x19` is the **payload[0]** after Rak unwrap.
- The internal header length is variable (reliability/order/split), so **payload start moves** even when the message is the same.
- Implementation reference: `Server/packages/packets/src/MSG_ID_WORLD_UPDATE.ts` (encode order).
