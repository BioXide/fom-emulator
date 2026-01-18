# Packet_ID_NOTIFY_107 (unconfirmed; aka Packet_Id107)

## Summary
- Status: unconfirmed; keep out of canonical flow until validated
- Direction: server -> client (also client -> server)
- Purpose: multi-subId control/notify packet; includes world-select alt path

## Field Table
| Offset | Field | Type | Encoding | Notes |
|---|---|---|---|---|
| 0x00 | msgId | u8 | raw | 0x6B (unconfirmed; packet id for notify 107 path) |
| 0x01 | subId | u16 | compressed | |
| 0x.. | optA/optB | u32 | compressed alt | Presence-gated |
| 0x.. | optC/optD | u32 | compressed | Presence-gated |
| 0x.. | strA/strB | char[2048] | LTClient string | |

## Read/Write (decomp)
- Read: `CShell.dll` @ `0x6570D8B0` (unverified)
- Write: `CShell.dll` @ `0x6570D9D0` (unverified)

## IDA Anchors
- ida: n/a
- ida2: `Packet_ID_NOTIFY_107_Read` `0x6570D8B0`, `Packet_ID_NOTIFY_107_Serialize` `0x6570D9D0` (unverified)

## Validation
- ida: n/a
- ida2: unverified (notes only)

## Notes / Edge Cases
- subId 231/270: worldId=4 (apartments); sets SharedMem[0x77]/[0x78] and world state=1.
- subId 269: if optA != 0 then worldId=optA; sets world state=1.
- Dispatch: handled by `Packet_ID_NOTIFY_107_DispatchSubId` (CShell.dll) from packet id 0x6B switch.
- Client -> server (known senders):
  - Login UI path builds and sends this packet (`Login_SendRequest_Throttled`).
  - Anti-cheat periodic ping: every 300s sends subId=1 with optA=21 and optC=playerId (`AntiCheat_PeriodicCheck`).
- Server -> client (selected subIds with concrete effects):
  - subId 269: if optA != 0, set worldId=optA and set world state=1.
  - subId 231/270: force worldId=4 (apartments) and set world state=1; updates SharedMem[0x77]/[0x78].
  - subId 325: character select display setup uses optC + strA/strB.
  - subId 44: inventory UI refresh.
- Full subId table: see `Docs/AddressMaps/AddressMap_CShell_dll.md` (Packet_ID_NOTIFY_107 section).

