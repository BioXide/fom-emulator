# ID_LOGIN (0x6E)

## Summary
- Direction: client -> master
- Purpose: auth payload following 0x6D (session hash + client fingerprints)

## Field Table
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | msgId | u8 | raw | 0x6E |
| 0x01 | username | char[64] | Huffman | LT Huffman path |
| 0x.. | sessionHashHex | char[64] | bounded string | From 0x6D session data |
| 0x.. | clientInfoU32[3] | u32[3] | compressed | Vector written by `BitStream_WriteU32Array3` |
| 0x.. | macAddress | char[32] | Huffman | |
| 0x.. | driveModels[4] | char[64] | bounded string | |
| 0x.. | driveSerials[4] | char[32] | bounded string | |
| 0x.. | loginToken | char[64] | bounded string | |
| 0x.. | computerName | char[32] | Huffman | |
| 0x.. | hasSteamTicket | bit | raw | |
| 0x.. | steamTicket | u8[1024] | compressed bytes | if flag set |
| 0x.. | steamTicketLength | u32 | compressed | if flag set |

## Read/Write (decomp)
- Write: `fom_client.exe` @ `0x0049B820` (Huffman + bounded strings + steam ticket)

## IDA Anchors
- ida: `Packet_ID_LOGIN_Write` `0x0049B820`
- ida2: n/a

## Validation
- ida: verified 01/05/26 (decompile)
- ida2: n/a

## Notes / Edge Cases
- This packet uses Huffman strings (not RakNet StringCompressor) for `username` and `computerName`.
- Steam ticket length is endian-swapped if platform endian requires it.

