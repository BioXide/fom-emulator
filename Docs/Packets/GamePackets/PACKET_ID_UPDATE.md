# PACKET_ID_UPDATE (0x7E)

## Summary
- Client -> server movement + weaponfire/update stream.
- Payload is a list of **WeaponFireEntry** records written by client.
- Built by `SendPacket_UPDATE` / `WeaponFireEntry_write` (client).

## Field Table (raw Rak frame)
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | rakMessageId | u8 | raw | 0x40 (RakNet internal packet) |
| 0x01–0x0F | rakHeader | bytes | raw | Rak internal header (variable length/bit‑aligned) |
| 0x10 | msgId | u8 | BitStream (LSB) | 0x7E (Packet_ID_UPDATE), **bit‑aligned** if header length shifts |
| 0x11 | entries[] | struct | BitStream (LSB) | Repeated WeaponFireEntry records; terminate by entryType==0 |
| 0x11+ | entries[].entryType | u8 | BitStream (LSB, compressed) | 0 terminates list |
| 0x11+ | entries[].playerId | u32 | BitStream (LSB, compressed) | Type‑2 only: `BitStream_WriteBitsCompressed(..., 0x20)` |
| 0x11+ | entries[].positionYaw | struct | BitStream (LSB) | Type‑2: `Write_QuantVec3_And9` (QuantVec3 + 9 bits) |
| 0x11+ | entries[].bitfieldBlock0x30 | struct | BitStream (LSB) | Type‑2: `Write_BitfieldBlock_0x30` |
| 0x11+ | entries[].skipOptionalBlock | u1 | BitStream (LSB) | Type‑2: If set, optional block is skipped |
| 0x11+ | entries[].pitchDegPlus90 | u8 | BitStream (LSB) | Type‑2: `field100 + 90` |
| 0x11+ | entries[].opt12_present | u1 | BitStream (LSB) | Type‑2: if set, read `opt12` |
| 0x11+ | entries[].opt12 | u12 | BitStream (LSB) | Type‑2: omitted if opt12_present == 0 |
| 0x11+ | entries[].opt5_present | u1 | BitStream (LSB) | Type‑2: if set, read `opt5` |
| 0x11+ | entries[].opt5 | u5 | BitStream (LSB) | Type‑2: omitted if opt5_present == 0 |
| 0x11+ | entries[].group134_present | u1 | BitStream (LSB) | Type‑2: if set, read group134 fields |
| 0x11+ | entries[].group134_u16c | u16 | BitStream (LSB, compressed) | Type‑2: only if group134_present |
| 0x11+ | entries[].group134_flag116 | u1 | BitStream (LSB) | Type‑2: only if group134_present |
| 0x11+ | entries[].group134_opt7_present | u1 | BitStream (LSB) | Type‑2: only if group134_present |
| 0x11+ | entries[].group134_opt7 | u7 | BitStream (LSB) | Type‑2: only if group134_opt7_present |
| 0x11+ | entries[].group134_optVec3 | struct | BitStream (LSB) | Type‑2: `Write_QuantVec3` if opt7 != 0 |
| 0x11+ | entries[].nibbles_present | u1 | BitStream (LSB) | Type‑2: if set, read 4+4 bits |
| 0x11+ | entries[].nibble_a | u4 | BitStream (LSB) | Type‑2: only if nibbles_present |
| 0x11+ | entries[].nibble_b | u4 | BitStream (LSB) | Type‑2: only if nibbles_present |
| 0x11+ | entries[].opt6_present | u1 | BitStream (LSB) | Type‑2: if set, read opt6 |
| 0x11+ | entries[].opt6 | u6 | BitStream (LSB) | Type‑2: only if opt6_present |
| 0x11+ | entries[].extra_present | u1 | BitStream (LSB) | Type‑2: `BitfieldBlock_0x30_HasExtra` |
| 0x11+ | entries[].extra_u16_present | u1 | BitStream (LSB) | Type‑2: only if extra_present |
| 0x11+ | entries[].extra_u16c | u16 | BitStream (LSB, compressed) | Type‑2: only if extra_u16_present |
| 0x11+ | entries[].opt_u7_163 | u7 | BitStream (LSB) | Type‑2: only if EquipSlotMask permits |
| 0x11+ | entries[].opt_u8_162 | u8 | BitStream (LSB) | Type‑2: trailing fields |
| 0x11+ | entries[].opt_3bits_176 | u3 | BitStream (LSB) | Type‑2: trailing fields |
| 0x11+ | entries[].opt_flag184 | u1 | BitStream (LSB) | Type‑2: trailing fields |
| 0x11+ | entries[].opt_10bits_188 | u10 | BitStream (LSB) | Type‑2: trailing fields |
| 0x11+ | entries[].opt_10bits_192 | u10 | BitStream (LSB) | Type‑2: trailing fields |
| 0x11+ | entries[].opt_flag164 | u1 | BitStream (LSB) | Type‑2: trailing fields |

## Notes
- The payload is bit-packed and built via `WeaponFireEntry_write` (client).
- Entry types are variable; **type 2** is the movement/weaponfire record.
- Writers (client, ida2):
  - `WeaponFireEntry_write` @ 0x658A1440
  - `WeaponFireEntry_type2_write` @ 0x658A00B0
  - `Write_QuantVec3_And9` @ 0x6596BE40
  - `Write_BitfieldBlock_0x30` @ 0x659575D0
