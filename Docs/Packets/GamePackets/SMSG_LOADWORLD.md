# SMSG_LOADWORLD (0x06)

## Summary
- Server -> client LithTech packet instructing the client to load the world.
- Bit-packed (LSB bit order) inside RakNet internal payload.

## Field Table
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | msgId | u8 | BitStream (LSB) | 0x06 |
| 0x01 | gameTime | f32 | BitStream (LSB) | Little-endian float |
| 0x05 | worldId | u16 | BitStream (LSB) | World identifier |

## Packet Capture
Length: 134 bytes
```
0000  40 00 00 00 00 39 9a 51 40 00 00 00 50 00 00 00  |@....9.Q@...P...|
0010  90 00 00 00 00 00 00 e6 69 3b 00 00 00 02 40 00  |........i;....@.|
0020  00 04 40 03 00 00 00 00 00 e6 69 31 00 00 00 00  |..@.......i1....|
0030  00 e6 69 3b 00 00 00 03 40 00 00 04 40 03 00 00  |..i;....@...@...|
0040  00 00 00 e6 69 31 00 00 00 00 00 e6 69 3b 00 00  |....i1......i;..|
0050  00 04 40 00 00 02 40 00 00 00 00 00 00 e6 69 3b  |..@...@.......i;|
0060  00 00 00 05 40 00 00 07 40 0e 48 04 07 00 00 00  |....@...@.H.....|
0070  00 00 00 00 20 0c 00 00 00 18 07 00 00 38 06 00  |.... ........8..|
0080  00 00 00 01 00 00                                |......|
```

## Notes
- Sent as part of the initial LithTech burst (often inside SMSG_PACKETGROUP).
- Structure referenced in `Docs/Notes/Login_Flow.md`.
