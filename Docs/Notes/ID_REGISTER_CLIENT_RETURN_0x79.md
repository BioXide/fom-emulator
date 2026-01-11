# ID_REGISTER_CLIENT_RETURN (0x79) Packet Structure

**Source**: `object.lto` IDA analysis  
**Addresses**:
- Constructor: `0x1007a850` (`Packet_ID_WORLD_LOGIN_DATA_Ctor`)
- Writer: `0x1007ab00` (`ID_WORLD_LOGIN_DATA_Write`)

---

## Packet Overview

This is a large, complex packet sent from World Server → Client in response to `ID_REGISTER_CLIENT (0x78)`. Contains player profile data, inventory, stats, appearance, and session state.

**Total struct size**: ~19,100 bytes (based on offsets seen in ctor)

---

## Packet Layout

### Header
| Offset | Type | Field | Notes |
|--------|------|-------|-------|
| 0x428 (1064) | u8 | packetId | Always 0x79 (121) |
| 0x430 (1072) | u8c | worldId | Compressed u8 |
| 0x434 (1076) | u32c | playerId | Compressed u32 (used as login gate; matches SharedMem[0x1EEC2]) |
| 0x438 (1080) | u8c | returnCode | Compressed u8 |

### ProfileA Block (offset 0x43C / 1084)
Written by `sub_100EAAF0` → calls 5 sub-writers:
1. `sub_100CA710` (this+0, bs) - Main profile header + array
2. `sub_100EBB30` (this+36, bs) - 12× optional item blocks  
3. `sub_10101BF0` (this+612, bs) - 3× optional item blocks
4. `sub_10101E20` (this+760, bs) - 6× optional item blocks
5. `sub_100CA710` (this+1048, bs) - Another profile array

**sub_100CA710 format**:
```
u16c  - header field 0
u32c  - field at +20
u32c  - field at +24
u32c  - field at +28
u16c  - array count = (*(this+12) - *(this+8)) / 44
[count × 44-byte entries via sub_100CA240]
```

**sub_100EBB30 format** (12 iterations):
```
for i in 0..12:
    bit  - hasEntry flag
    if hasEntry:
        sub_100DB8E0(entry)  // item/equipment block
```

### ProfileB Block (offset 0x878 / 2168)
Written by `WorldLogin_WriteProfileBlockB` @ `0x100ea9e0`
```
for i in 0..4:
    u16c  - value at (this + 2 + i*16)
```
4 compressed u16 values, each offset by 16 bytes in source struct.

### ProfileC Block (offset 0x8B8 / 2232)
Written by `WorldLogin_WriteProfileBlockC` @ `0x100c8b80`
Read by `WorldLogin_ReadProfileBlockC` @ `0x100c8d20`
Used by `AppearanceCache_BuildFromProfileC` @ `0x10006f50` for character model selection

**Character Appearance Structure** (48 bytes on-wire; 50-byte stride in list adds 2-byte local marker):

| Index | Bits | Field | Description |
|-------|------|-------|-------------|
| [0] | 1 | gender | 0=male, 1=female |
| [1] | 1 | skinColor | 0=white, 1=black |
| [2] | 5 | headTextureIdx | Head texture (0-27) |
| [3] | 5 | hairTextureIdx | Hair texture (0-22) |
| [4-5] | 32 | unknownU32 | Unknown 32-bit field |
| [6] | 5 | unknown | Unknown |
| [7] | 6 | unknown | Unknown |
| [8] | 12 | **torsoTypeId** | Type 11/13 item (611=male, 797=female) |
| [9] | 12 | **legsTypeId** | Type 12/14 item (760=male, 907=female) |
| [10] | 12 | **shoesTypeId** | Type 15 item (500=male, 510=female) |
| [11-19] | 12×9 | accessories | Optional - Type 5/6/7/23 items |
| [20-24] | 1×4 | flags | Various flags |

**Wire format:**
```
bits[1]   - gender (0=male)
bits[1]   - skinColor (0=white)
bits[5]   - headTextureIdx
bits[5]   - hairTextureIdx
bits[32]  - unknownU32
bits[5]   - unknown
bits[6]   - unknown
bits[4]   - unknown
bits[12]  - torsoTypeId (CRITICAL - must be valid Type 11/13)
bits[12]  - legsTypeId (CRITICAL - must be valid Type 12/14)
bits[12]  - shoesTypeId (CRITICAL - must be valid Type 15)

// Optional ability section (indices 11-19)
if any of accessories[0..8] != 0:
    bit 1
    bits[12] × 9  - accessory type IDs
else:
    bit 0

bits[1] × 4 - flags
```

**CRITICAL**: Invalid torso/legs/shoes type IDs will cause `AppearanceCache_BuildFromProfileC` to 
fall back to default textures, but may still cause issues with model loading.

### ProfileD Block (offset 0x8EC / 2284)
Written by `WorldLogin_WriteProfileBlockD` @ `0x100e3440`
```
for i in 0..52:
    u32c  - array of 53 compressed u32 values
```

### TableI Block (offset 0xC9C / 3228)
Initialized by `WorldLogin_TableI_Init` at `(this + 807) * 4 = 0xC9C`

Written by `sub_100DDE70`:
```
u8c   - field at +36
u8c   - field at +37
u8c   - field at +38
u8c   - field at +39
u32c  - field at +32
u32c  - entry count = (*(this+8) - *(this+4)) / 20
[count × entries via sub_100DDC50]
```

### StringBundleE Block (offset 0xCCC / 3276)
Written by `WorldLogin_WriteStringBundleE` @ `0x1007aa30`
Read by `WorldLogin_ReadStringBundleE` @ `0x10078b80`

**Field mapping from Handler @ `0x1007adcd`:**
| Blob Offset | Decoded Size | SharedStringTable Key | Purpose |
|-------------|--------------|----------------------|---------|
| 5 | 20 bytes | 11219 | **playerName** - Character name, used in player interaction/activation |
| 25 | 544 bytes | 11224 | **avatarData** - Appearance/avatar customization, written by `Handle_MSG_ID_AVATAR_CHANGE` |
| 57 | 36 bytes | 126546 | **factionOrTitle** - Faction name, guild tag, or title string |
| 569 | ? | (not written) | **unknownBlob** - Not written to SharedStringTable, unknown purpose |

**Wire format:**
```
u32c         - bundleId at offset 0
bit          - flag at offset 4
blob[2048]   - playerName (offset 5) - huffman encoded, max 20 bytes decoded
blob[2048]   - avatarData (offset 25) - huffman encoded, max 544 bytes decoded
blob[2048]   - factionOrTitle (offset 57) - huffman encoded, max 36 bytes decoded
blob[2048]   - unknownBlob (offset 569) - huffman encoded
```

**Key usage traced:**
- Key 11219: Read by `SharedStringTable_ReadKey11219` @ `0x10012640`, called from `CCharacter_OnCommandActivate` for player-to-player interactions
- Key 11224: Written by `SharedStringTable_WriteKey11224` @ `0x1005a370`, referenced in avatar change handling
- Key 126546: Written during world login, likely faction/guild identifier

### Flag Fields (offset 0xF28 / 3880)
```
u8c   - offset 0xF28 (3880) - default 3
u8c   - offset 0xF29 (3881) - default 0
u16c  - offset 0xF2A (3882) - array count
```

### ProfileC Array (offset 0xF2C / 3884)
```
for i in 0..count:  // count from 0xF2A
    WorldLogin_WriteProfileBlockC (50 bytes each)
```
Array of up to 300 entries (loop in ctor: `for i = 299..0`)

### CompactVec3 Block 1 (offset 0x49C8 / 18888)
Written by `sub_100DF040` → `sub_100E1F10` + 9 bits:
```
// sub_100E1F10 - CompactVec3 write
if precision < 16:
    bits[precision] - abs(x)
    bits[precision] - abs(y)  
    bits[precision] - abs(z)
    bit - sign_x
    bit - sign_y
    bit - sign_z
else:
    u16c - x
    u16c - y
    u16c - z

bits[9] - offset 12
```

### Currency Fields (offset 0x49D8 / 18904)
```
u32c  - currencyA at 0x49D8 (18904)
u32c  - currencyB at 0x49DC (18908)
```

### Flag + ID (offset 0x49E0 / 18912)
```
bit   - flag at 0x49E0 (18912)
u16c  - id at 0x49E2 (18914)
u32c  - field_18916 at 0x49E4 (18916)
```

### EntryGBlock (offset 0x49E8 / 18920)
Written by `WorldLogin_WriteEntryG` @ `0x100171e0`
```
for i in 0..10:
    WorldLogin_WriteEntryG (12 bytes each)
```

**WorldLogin_WriteEntryG** @ `0x100171e0`:
```
if !this[5] || !this[4]:
    bit 0  // no entry
else:
    bit 1  // has entry
    u16c     - offset 0
    u8c      - offset 2
    u8c      - offset 3
    bits[7]  - offset 4
    bits[7]  - offset 5
    bits[9]  - offset 6
    u8c      - offset 8
    u8c      - offset 9
    u8c      - offset 10
```

### Blob2048 (offset 0x4A60 / 19040)
Written by vtbl+52 (StringCompressor_EncodeString)
Read by vtbl+56 (StringCompressor_DecodeString)

This is a standalone huffman-encoded string blob separate from StringBundleE.
Not written to SharedStringTable in the handler - purpose TBD.

```
blob[2048]  - via vtbl+52 call, max 2048 bits huffman encoded
```

### Block0C9C (offset 0xC9C / 3228)
Written by `sub_100DDE70` (see TableI format above)

### CompactVec3 Block 2 (offset 0x4A80 / 19072)
Same format as CompactVec3 Block 1

### Final Flag + ListK (offset 0x4A90 / 19088)
```
bit   - flag at 0x4A90 (19088)
block - WorldLogin_ReadListK at 0x4A94 (19092)
```

ListK format:
```
u32c  - headerA
u32c  - headerB
u32c  - count
[count x entries]:
  u16c id
  u8c  value
  bit  flag
```
## Default Values (from Constructor)

| Offset | Value | Purpose |
|--------|-------|---------|
| 0x428 (1064) | 121 (0x79) | Packet ID |
| 0x430 (1072) | -1 (0xFF) | worldId default |
| 0x438 (1080) | 0 | returnCode |
| 0xF28 (3880) | 3 | flag1 |
| 0xF29 (3881) | 0 | flag2 |
| 0xF2A (3882) | 0 | array count |
| 0x49C4 (18884) | 1 | vec3 flag |
| 0x49E0 (18912) | 0 | flag |
| 0x4A60 (19040) | 0 | blob flag |
| 0x4A90 (19088) | 0 | final flag |

---

## Minimal Empty Packet Strategy

For initial progression, write minimal valid structure:

1. **Header**: packetId=0x79, worldId, playerId, returnCode=1
2. **ProfileA**: 
   - sub_100CA710: u16c(0), u32c(0), u32c(0), u32c(0), u16c(0) = empty array
   - sub_100EBB30: 12× bit(0)
   - sub_10101BF0: 3× bit(0)
   - sub_10101E20: 6× bit(0)
   - sub_100CA710: same as first
3. **ProfileB**: 4× u16c(0)
4. **ProfileC**: All zeros per field layout + bit(0) for abilities + 4× bit(0)
5. **ProfileD**: 53× u32c(0)
6. **StringBundleE**: u32c(0), bit(0), 4× blob(0)
7. **Flags**: u8c(3), u8c(0), u16c(0)
8. **Vec3 Block 1**: zeros + bits[9]=0
9. **Currency**: u32c(0), u32c(0)
10. **Flag+ID**: bit(0), u16c(0), u32c(0)
11. **EntryGBlock**: 10x bit(0)
12. **Blob2048**: length=0
13. **Block0C9C**: u8c×4(0), u32c(0), u32c(0)
14. **Vec3 Block 2**: zeros
15. **ListK**: bit(0), u32c(0), u32c(0), u32c(0)

---

## Key Observations

1. **Heavy use of compressed writes**: Most values use `BitStream_WriteCompressed` with unsigned flag
2. **Blob2048**: Uses virtual call `vtbl+52` for variable-length blob writing (max 2048 bits)
3. **ProfileC has complex conditional**: Ability section only written if any ability value non-zero
4. **Array patterns**: Many blocks use `(end - start) / stride` to compute count before iterating
5. **Big-endian handling**: All multi-byte writes check `Net_IsBigEndian()` and swap if needed (we can ignore - always little-endian)

---

## Implementation Notes

Current implementation in `ID_REGISTER_CLIENT_RETURN.ts` writes garbage data. Need to:
1. Match exact bit-level format for each block
2. Use `writeBits()` for non-byte-aligned fields (ProfileC especially)
3. Implement proper blob2048 write (u16c length + raw bits)
4. Ensure all empty arrays write count=0 correctly
