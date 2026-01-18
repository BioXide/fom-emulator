# ID_LOGIN_REQUEST (0x6C)

## Summary
- Direction: client -> master
- Purpose: initial login request (username + clientVersion)

## Field Table
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | msgId | u8 | raw | 0x6C |
| 0x01 | huffmanBitCount | u32 | LT BitStream compressed | Written by `BitStream_WriteCompressed_U32` |
| 0x.. | huffmanBits | bits | Huffman | Bit-aligned |
| 0x.. | clientVersion | u16 | LT BitStream compressed | |

## Read/Write (decomp)
- Read: `fom_client.exe` @ `0x0049B6C0` (Huffman_ReadString + ReadCompressed_U16)
- Write: `fom_client.exe` @ `0x0049B720` (Huffman_WriteString + WriteCompressed_U16)

## IDA Anchors
- ida: `Packet_ID_LOGIN_REQUEST_Read` `0x0049B6C0`, `Packet_ID_LOGIN_REQUEST_Write` `0x0049B720`
- ida2: n/a

## Validation
- ida: verified 01/05/26 (decompile)
- ida2: n/a

## Notes / Edge Cases
- Strings decode into fixed buffers; clamp to `maxLen-1` before encode.

