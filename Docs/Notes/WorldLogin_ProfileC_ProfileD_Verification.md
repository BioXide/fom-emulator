# WorldLogin ProfileC/ProfileD Verification (Object.lto)

Date: 2026-01-09
IDA: ida1 (Object.lto), image base 0x67350000

## Scope
Validate ProfileC, ProfileD, and the combined buffer used in Handle_ID_WORLD_LOGIN against Object.lto.

## ProfileC is bit-packed with a conditional 9x12 block
Source: WorldLogin_WriteProfileBlockC @ 0x67418B80; WorldLogin_ReadProfileBlockC @ 0x67418D20.

Observed write sequence (bit widths, in order):
- 1, 1, 5, 5, 32, 5, 6, 4, 12, 12, 12
- Then a flag bit. If set, writes 9 fields of 12 bits each (offsets +22..+38 in the backing word array).
- Then 4 single-bit flags (offsets +40..+46).

This matches the bit-layout documented in Docs/Packets/ID_WORLD_LOGIN_DATA.md and contradicts any fixed u16 slot layout.

## ProfileD count is 53 u32 values
Source: WorldLogin_ReadProfileBlockD @ 0x674334A0; WorldLogin_WriteProfileBlockD @ 0x67433440.

Both functions loop exactly 53 times, reading/writing 32-bit compressed values.

## Combined ProfileC/ProfileD buffer usage in Handle_ID_WORLD_LOGIN
Source: Handle_ID_WORLD_LOGIN @ 0x673CAD90.

Key operations:
- Stack buffer is _WORD profileC_profileD_block[34].
- Copies 0x30 bytes (48) into slot C: qmemcpy(profileC_dst, profileC_profileD_block, 0x30).
- Copies appearance marker: profileC_dst[24] = profileC_profileD_block[24].
- Sets init byte: *((_BYTE *)profileC_dst + 48) = 1.
- Attributes read as dwords starting at word index 26:
  AttributeTable_SetValueFromServer(..., *(_DWORD *)&profileC_profileD_block[2 * statIndex + 26]).

Implication: ProfileC is 48 bytes of packed appearance + a u16 marker, with a local init byte.
Attributes are a contiguous u32 array starting at word index 26, and ProfileD must carry 53 u32 values.
