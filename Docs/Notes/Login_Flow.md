# Login Flow (Client <-> Master <-> World)

## Overview (packet sequence)
CLIENT              MASTER SERVER           WORLD SERVER
   |                      |                       |
   |-- 0x6C LOGIN_REQ --->|                       |
   |<-- 0x6D LOGIN_RET ---|                       |
   |-- 0x6E LOGIN ------->|                       |
   |<-- 0x6F LOGIN_RET ---|                       |
   |<-- 0x7B WORLD_SEL ---|                       |
   |-- 0x72 WORLD_LOGIN ->|                       |
   |<-- 0x73 (IP:Port) ---|                       |
   |                      |                       |
   |-- [RakNet Connect] ----------------------->|
   |<-- [RakNet Accept] ------------------------|
   |-- 0x72 WORLD_LOGIN ----------------------->|
   |<-- LithTech Burst (NO 0x73!) --------------|

CLIENT                                     WORLD SERVER
   |                                             |
   |-- [RakNet Connect w/ password] ----------->|
   |<-- [RakNet Accept] ------------------------|
   |                                             |
   |-- 0x72 WORLD_LOGIN ----------------------->|
   |                                             |
   |<-- LithTech Burst (SMSG_PACKETGROUP) ------|
   |       SMSG_NETPROTOCOLVERSION (4)           |
   |       SMSG_YOURID (12)                      |
   |       SMSG_CLIENTOBJECTID (7)               |
   |       SMSG_LOADWORLD (6)                    |
   |                                             |
   |-- MSG_ID 0x09 CONNECTSTAGE=0 ------------->|
   |                                             |
   |<-- SMSG_UPDATE (8) spawn packet -----------|
   |       GroupObjUpdate w/ CF_NEWOBJECT        |
   |       + POSITION + ROTATION + MODELINFO     |
   |                                             |
   |<-- SMSG_UNGUARANTEEDUPDATE (10) heartbeat -|
   |       (periodic, 10-20 Hz)                  |

## Packet roles (quick map)
- 0x6C LOGIN_REQUEST: client -> master
- 0x6D LOGIN_REQUEST_RETURN: master -> client
- 0x6E LOGIN: client -> master
- 0x6F LOGIN_RETURN: master -> client
- 0x7B WORLD_SELECT: master -> client
- 0x72 WORLD_LOGIN: client -> master, then client -> world
- 0x73 WORLD_LOGIN_RETURN: master -> client (world IP/port)

## Packet layouts (summary)

### 0x6C LOGIN_REQUEST (client -> master)
- username (Huffman)
- u16 token
- optional timestamp header (RakNet)

### 0x6D LOGIN_REQUEST_RETURN (master -> client)
- u8c status
- session_str (LTClient read string, max 2048)

### 0x6E LOGIN (client -> master)
- username (Huffman)
- sessionHashHex (bounded string, max 64)
- clientInfoU32[3]
- macAddress (Huffman, "xx-xx-xx-xx-xx-xx")
- 4x pairs: bounded string(64) + bounded string(32)
- hostName (bounded string, max 64)
- computerName (Huffman, max 32)
- blobFlag bit; if set: 0x400 blob bytes + u32 blobU32

### 0x72 WORLD_LOGIN (client -> master/world)
- u8c worldId
- u8c worldInst
- u32c playerId
- u32c worldConst (= 0x13BC52)

### 0x7B WORLD_SELECT (master -> client)
Read order:
- u32c playerId
- u8c  subId
Type payload:
- subId=2 -> ItemsAdded payload
- subId=3 -> u32c + u8c + u8c
- subId=4 -> u8c worldId, u8c worldInst (sets SharedMem 0x1EEC1/0x1EEC2, state=1)
- subId=6 -> list payload (WorldSelect_HandleSubId6Payload)
- subId=7 -> u8c worldId, u8c worldInst

### 0x73 WORLD_LOGIN_RETURN (master -> client)
Read order:
- u8c code
- u8c flag
- u32c worldIp
- u16c worldPort
Code handling (CShell):
- code==1: UI msg 1725, then Connect(worldIp, worldPort)
- code in {2,3,4,6,7}: UI msg 1723/1734/1724/1735/1739, then ShowMessage(5)
- code==8: retry after 5s
- default: UI msg 1722
Note: encode IP as u32c big-endian (127.0.0.1 => 0x7F000001).

## World login state machine (CShell)
SharedMem gates:
- 0x1EEC0: world login state (0 idle, 1 pending, 2 waiting connect, 3 load world)
- 0x1EEC1: worldId
- 0x1EEC2: worldInst
- 0x54: apartment login gate (bool)
- 0x78: apartmentId (1..24)
- 0x74: apartment flag set to 1 before load

State 1 -> 2:
- if not connected and not blocked, build/send 0x72 using SharedMem values.

State 3:
- worldId==4 -> apartments: path "worlds\\apartments\\<name>"
- else -> path "worlds\\<name>"
- writes SharedMem string index 19 = path, then loads world

## Troubleshooting (RakNet peer registration)
If client drops 0x6D/0x7B/0x73 before handlers:
- Ensure the server sends an **unwrapped** ID_CONNECTION_REQUEST_ACCEPTED (0x0E)
  so the peer is registered before reliable frames arrive.
