# CMSG_CONNECTSTAGE (0x09)

## Summary
- Client -> server LithTech control packet sent after LOADWORLD.
- Bit-packed (LSB bit order) inside RakNet internal payload.

## Field Table (raw Rak frame)
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | rakMessageId | u8 | raw | 0x40 (RakNet internal packet) |
| 0x01–0x0F | rakHeader | bytes | raw | Rak internal header (variable length/bit‑aligned) |
| 0x10 | msgId | u8 | BitStream (LSB) | 0x09, **bit‑aligned** (starts at bit+4 in 0x10 when bit‑offset is 132) |
| 0x11 | stage | u8 | BitStream (LSB) | Usually 0 on initial connect; observed 0/1 (bit‑aligned after msgId) |

## Packet Capture
Length: 26 bytes
```
0000  40 00 00 00 00 b4 d7 ee 80 00 00 02 d0 00 00 00  |@...............|
0010  90 00 00 00 00 00 02 d3 5f ba                    |........_.|
```

## Notes
- Seen immediately after SMSG_LOADWORLD during world connect.
- Payload is typically 16 bits (msgId + stage).
- Offsets above are **raw-frame**. The msgId begins at a **bit offset** (observed 100 or 132),
  which can land inside byte 0x10 (e.g., 0x90 → bits `00001001` = 0x09).
- Confirmed in `Docs/Notes/Login_Flow.md` and `Docs/Notes/World_Server_First_10s_Packets.md`.
