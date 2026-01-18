# ID_NEW_INCOMING_CONNECTION (0x10)

## Summary
- Direction: server -> client
- Purpose: RakNet notify of new incoming connection

## Field Table
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | msgId | u8 | raw | 0x10 |
| 0x01 | systemAddress | SystemAddress | raw | Remote system |
| 0x.. | internalIds | SystemAddress[] | raw | Array length from RakNet |

## Read/Write (decomp)
- Write: RakNet 3.611 `outBitStream.Write((MessageID)ID_NEW_INCOMING_CONNECTION)` send path
- Read: RakNet 3.611 parse path in `RakPeer::RunUpdateCycle`

## IDA Anchors
- ida: pending (RakNet in `fom_client.exe` not yet mapped)
- ida2: n/a

## Validation
- ida: pending
- ida2: n/a
- Source of truth: `Server\\packagers\\networking\\native\\raknet\\src\\RakPeer.cpp`

## Notes / Edge Cases
- ConnectMode transitions to CONNECTED on receipt.

