# World Update Spawn (MSG_ID_WORLD_UPDATE / 0x19)

Source: fom_client.exe (IDA3). Image base 0x00400000 (IDA base 0x5AD50000).

## Summary
- Remote player spawn is handled by MSG_ID_WORLD_UPDATE (packet id 0x19).
- Entry type 2 triggers character spawn/update (CCharacter).
- Entry type 1 is "extended" character entry (adds a few fields, then type 2 layout).
- Client ignores world update unless world login is active and worldInst matches.

## Gating Conditions (client)
Function: Handle_MSG_ID_WORLD_UPDATE
- VA 0x00451CA0 / RVA 0x00051CA0
- Reads header u32c worldInst, u32c seqOrTs.
- Drops packet unless:
  - SharedMem[0x5B] == worldInst
  - SharedMem flag 0x55 set (set on world login success)

## Packet ID
Packet_ID_WORLD_UPDATE_Ctor sets id to 0x19
- VA 0x0044C740 / RVA 0x0004C740

## Entry Dispatch
WorldUpdate_ReadEntry
- VA 0x00451950 / RVA 0x00051950
- Reads entry type: BitStream_ReadCompressed(..., 8 bits)
- Types:
  - 1: WorldUpdate_ReadCharacterEntry_Ext
  - 2: WorldUpdate_ReadCharacterEntry
  - 3: Enemy
  - 4: Turret

## Character Spawn Path
WorldUpdate_SpawnCharacter
- VA 0x0044FF00 / RVA 0x0004FF00
- Spawns CCharacter (not CPlayerObj) via g_pLTServer->CreateObject.
- Applies ProfileC to object and sets name "<Unknown>".

## Entry Type 2 Layout (WorldUpdate_ReadCharacterEntry)
Function: WorldUpdate_ReadCharacterEntry
- VA 0x0044EC50 / RVA 0x0004EC50

Read order (bitstream):
1) u32c netId -> struct+4
2) CompactVec3S16Yaw -> struct+8
   - bitlen = 16 (u16c_signed path)
   - x/y/z = u16c_signed
   - yaw = 9 bits
3) ProfileBlockC -> struct+34 (see ProfileC layout below)
4) 1 bit -> struct+132 (spawn gate)
   - If this bit is 1, the entry is treated as partial update (spawn not attempted)
5) If struct+132 == 0, reads additional optional fields in this order:
   5.1) 8 bits -> struct+100; stored as (value - 90)
   5.2) bit -> if 1 read 12 bits into struct+104, else default 16
   5.3) bit -> if 1 read 5 bits into struct+108, else 0
   5.4) bit -> if 1:
        - u16c -> struct+134
        - bit -> struct+116
        - bit -> if 1 read 7 bits into struct+120, else 0
        - if struct+120 != 0 then CompactVec3S16 -> struct+136
   5.5) bit -> if 1 read 4 bits -> struct+148 and 4 bits -> struct+149
   5.6) bit -> if 1 read 6 bits -> struct+128 else 0
   5.7) if ProfileC has any slots 11..19 set:
        - bit -> if 1 read u16c -> struct+150 else 0
        - if ItemType_HasBitFlag(TypeById(0x68), struct+150) then read 7 bits -> struct+163
   5.8) 8 bits -> struct+162
   5.9) 3 bits -> struct+176
   5.10) bit -> struct+184
   5.11) 10 bits -> struct+188
   5.12) 10 bits -> struct+192
   5.13) bit -> struct+164

Note: for initial spawn, set struct+132 bit to 0 and keep optional presence bits 0.

## Entry Type 1 Layout (WorldUpdate_ReadCharacterEntry_Ext)
Function: WorldUpdate_ReadCharacterEntry_Ext
- VA 0x004518C0 / RVA 0x000518C0

Read order (bitstream):
A) u32c -> struct+24
B) u32c -> struct+28
C) compressed 8 bits -> struct+32
D) bit -> if 1 read u32c -> struct+156 else 0
E) bit -> if 1 read 3 bits -> struct+152 else 0
F) u32c -> struct+180
G) then calls WorldUpdate_ReadCharacterEntry (type 2 layout above)

## CompactVec3S16 and Yaw
WorldLogin_ReadCompactVec3S16Yaw
- VA 0x004DF070 / RVA 0x000DF070

WorldLogin_ReadCompactVec3S16
- VA 0x004E1FF0 / RVA 0x000E1FF0

CompactVec3 rules:
- If bitlen < 16: read N bits for x/y/z, then sign bits for each axis
- If bitlen >= 16: read u16c_signed for x/y/z
- yaw uses 9 bits (0..511)

## ProfileC Layout (bitstream)
Function: WorldLogin_ReadProfileBlockC
- VA 0x004C8D20 / RVA 0x000C8D20

Read order (bits unless specified):
- w0  : 1
- w1  : 1
- w2  : 5
- w3  : 5
- w4  : 32
- w5  : 5
- w6  : 6
- w7  : 4
- w8  : 12
- w9  : 12
- w10 : 12
- if bit == 1 then read w11..w19 (9 fields), each 12 bits
- w20 : 1
- w21 : 1
- w22 : 1
- w23 : 1

ProfileBlockC_HasSlots11To19 checks w11..w19 for any non-zero.

## Appearance Mapping (ProfileC -> model/skins)
Function: AppearanceCache_BuildFromProfileC
- VA 0x00406F50 / RVA 0x00006F50

Known mapping (indices are word slots in ProfileC):
- w0: gender (1 = female)
- w1: tone group (0/1 used for Black/White in skin strings)
- w2: head skin index (gendered table)
- w3: head detail/secondary skin index (gendered table)
- w8: torso item (type 11/13 gate) -> torso model + skin
- w9: legs item (type 12/14 gate) -> legs model + skin
- w10: boots/feet item (type 15 gate)
- w11: accessory (type 5 gate)
- w13: accessory (type 7 gate)
- w14: accessory (type 5 gate)
- w15: accessory (type 5 gate)
- w16: accessory (type 5 gate)
- w18: accessory (type 5 gate)
- w19: hands item (type 5 gate); fallback hands skin if missing

Fallback behavior:
- Torso/legs/hands use default skin strings if item type check fails.
- Head/face skins map to tables (gendered) and format into Skins/Characters/Head/*.dtx.

## Unknowns / TODO
- Semantics for the optional update fields (struct+100..192): need mapping of meaning to bits.
- Appearance table row layout (dword_5AF09710): only +20/+28 string usage confirmed.
- Validate ProfileC index meanings for w4..w7, w20..w23.

## Next Steps
- Build server-side MSG_ID_WORLD_UPDATE writer with:
  - header worldInst + seq
  - entry type 2
  - netId + CompactVec3S16Yaw (bitlen=16)
  - ProfileC
  - spawn gate bit = 0, optional presence bits = 0
- If needed, add entry type 1 prelude.
