# ID_LOGIN_REQUEST_RETURN (0x6D)

## Summary
- Direction: master -> client
- Purpose: status + username echo for login request

## Field Table
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | msgId | u8 | raw | 0x6D |
| 0x01 | status | u8 | LT BitStream byte-array compressed | See note above |
| 0x.. | huffmanBitCount | u32 | LT BitStream compressed | |
| 0x.. | huffmanBits | bits | Huffman | Bit-aligned |

## Read/Write (decomp)
- Write: `fom_client.exe` @ `0x0049B7C0` (WriteByteArrayCompressed + Huffman_WriteString)
- Read: `CShell.dll` @ `0x6588DCE0` (ReadCompressed(8) + LTClient DecodeString)

## IDA Anchors
- ida: `Packet_ID_LOGIN_REQUEST_RETURN_Write` `0x0049B7C0`
- ida2: `Packet_ID_LOGIN_REQUEST_RETURN_Read` `0x6588DCE0` (base-adjusted)

## Validation
- ida: verified 01/05/26 (decompile)
- ida2: verified 01/05/26 (decompile)

## Notes / Edge Cases
- Mixed naming (`WriteByteArrayCompressed` vs `ReadCompressed`) suggests a thin wrapper; keep server encoding aligned to client write path.

## Status Enum
| Name | Value |
|---|---|
| LOGIN_REQUEST_RETURN_INVALID_INFO | 0 |
| LOGIN_REQUEST_RETURN_SUCCESS | 1 |
| LOGIN_REQUEST_RETURN_OUTDATED_CLIENT | 2 |
| LOGIN_REQUEST_RETURN_ALREADY_LOGGED_IN | 3 |

