# ID_LOGIN_TOKEN_CHECK (0x70)

## Summary
- Direction: bidirectional
- Purpose: token-based authentication check

## Field Table
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | msgId | u8 | raw | 0x70 |
| 0x01 | fromServer | bit | raw | 0 = client->server, 1 = server->client |
| 0x.. | success | bit | raw | only when fromServer=1 |
| 0x.. | requestToken | char[32] | bounded string | only when fromServer=0 |
| 0x.. | username | char[32] | bounded string | only when fromServer=1 |

## Read/Write (decomp)
- Read: `CShell.dll` @ `0x6578AA10`
- Write: `CShell.dll` @ `0x6578AAA0`

## IDA Anchors
- ida: n/a
- ida2: `Packet_ID_LOGIN_TOKEN_CHECK_Read` `0x6578AA10`, `Packet_ID_LOGIN_TOKEN_CHECK_Write` `0x6578AAA0`

## Validation
- ida: n/a
- ida2: verified 01/05/26 (decompile)

## Notes / Edge Cases
- `fromServer` is read from the BitStream bit cursor, then payload is conditionally parsed.

