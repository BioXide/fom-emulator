# World/Object Loading and World Services (Terminals)

Status: living document; update as new evidence is confirmed.
Last updated: 2026-01-14

## Current Blocker (2026-01-14)
We still do not see CMSG_CONNECTSTAGE on the world server. To prove whether RakNet is dropping
0x09 before the TS layer, the world server must be started with native RakNet logging enabled
from the same shell.

Run (world server):
```
$env:FOM_RAKNET_NATIVE_LOG="1"
$env:FOM_RAKNET_NATIVE_LOG_ID="0x09"
$env:FOM_RAKNET_NATIVE_LOG_MAX="128"
bun run src/index.ts
```

Logs:
- `Server/apps/world/logs/raknet_native.out.log`
- `Server/apps/world/logs/raknet_native.err.log`

Status:
- World server started with env set; no `[RakNet FFI][recv]` lines yet.
- Waiting for a client connection to emit 0x09 so we can confirm where it drops.

## Logging Fixes (2026-01-14)
Server packet parsing/logs were misclassifying ID_TIMESTAMP frames because we always assumed
64-bit timestamps. Updated world server to choose 32 vs 64 based on plausible inner IDs,
so internal ping/pong frames unwrap correctly and stop masquerading as world queries.
Also updated PacketLogger console mirror to skip packet header lines so the log file
stops duplicating the console packet output.

## Scope
This document maps how world objects (including terminals/world services) are loaded and replicated into the client, and how SQL-derived world data should be translated into packets for the emulator.

Key goals:
- Identify which packets carry object creation and updates.
- Describe payload layout and timing.
- Map world service SQL rows to object fields.
- Explain how fileId -> filename is established and used by the client.

## Relevant Artifacts
- Client authoritative server code: `Client/Client_FoM/server.dll` (IDA: ida4 @ 13340)
- Client object logic: `Client/Client_FoM/Resources/Object.lto` (IDA: ida3 @ 13339)
- Client net update handling: `Client/Client_FoM/fom_client.exe` (IDA: ida2 @ 13338 / ida3 @ 13339)
- World DB schema: `Docs/Database/WorldDB.md`
- Terminal models: `Client/Client_FoM/Resources/Models/Props/Terminals`
- World update spawn layout: `Docs/Notes/WorldUpdate_Spawn.md`
- World service resource list: `Docs/WorldServiceResourceList.csv`

## High-Level Flow (Authoritative in Client)
1) UDP server forwards bitstream; it does not run server.dll.
2) Client executes authoritative server logic locally (Object.lto/server.dll equivalents).
3) Emulator must parse world SQL data and synthesize object creation/update packets.

## Packet Sequence: Enter World
Server init flow (server.dll -> client):
- Send string table entries (message id 15).
- Send loadworld (message id 6).
- Start object update streams:
  - SMSG_UPDATE (message id 8)
  - SMSG_UNGUARANTEEDUPDATE (message id 0x0A)

Implication:
- The client expects **loadworld first**, then object updates.
- **MSG_ID_WORLD_UPDATE (id 0x19)** is separate (characters/enemies/turrets) and not used for terminal objects.

## Packet IDs (Confirmed)
- id 6: loadworld
- id 8: SMSG_UPDATE (guaranteed object updates)
- id 0x0A: SMSG_UNGUARANTEEDUPDATE (fast/delta stream)
- id 15: string table entry
- id 19 (0x13): SMSG_PRELOADLIST (resource preload list)

## SMSG_UPDATE Payload Layout (server.dll)
Core encoder: `Server_WriteUpdateEntry` @ 0x10047A70.

Per-object entry (bitstream):
1) Update flags (1 or 2 bytes)
2) Object ID (u16)
3) Optional blocks based on flags

### Flag-driven fields (order matters)
- Flag 0x0001: create/full state
  - object type (u8)
  - position (LTVector)
  - optional parent block (count + blob)
  - type-specific payload:
    - type 1 (world model): `Server_WriteModelFiles`
    - type 2 / 9: C-string (type 9 adds u16)
    - type 3: u16 resource id
- Flag 0x0800: model file update
  - type 1: `Server_WriteModelFiles`
  - type 3: u16 resource id
- Flag 0x2020: animation info
  - type 1: `WriteAnimInfo`
  - type 3: 64-bit anim bits
- Flag 0x0008: object flags
  - u16 (flagsA)
  - u16 (flagsB)
  - u32 (flagsC)
- Flag 0x0040: rgba + extra byte
  - 5 bytes (RGBA + extra)
  - if type 4: u16 from float
- Flag 0x0010: scale-like vector
  - 3 floats (vec3)
- Flag 0x4202: position + velocity
  - if flagsA & 0x100: full vector
  - else: compressed position + compressed velocity
- Flag 0x0404: rotation
  - if flagsA & 0x100: 128-bit rotation
  - else: compressed rotation
- Flag 0x0100: attachments
  - repeated entries: u16 objId, u32 unknown, vec3, rotation
  - terminator: u16 0xFFFF
  - if type 1: 3x u32 extra
- Flag 0x8000: extra LTVector

### Model file block
Encoder: `Server_WriteModelFiles` @ 0x10046880.
- u16 modelId
- numSkins (6 bits), then (numSkins-1) u16 skin ids
- numRenderStyles (6 bits), then that many u16 renderstyle ids
- numOther (4 bits), then that many u16 ids

These ids resolve via the fileId map (see below).

## SMSG_UNGUARANTEEDUPDATE Payload Layout
Encoder: `Server_WriteUnguaranteedEntry` @ 0x10041F30.

Handler: `OnUnguaranteedUpdatePacket` @ 0x006E60D0 (base 0x006C0000).
Loop reads `u16 objectId` + `u4 flags`. If `objectId == 0xFFFF`, reads `float gameTime` and terminates.

Flags:
- 0x4: compressed pos (+ optional velocity)
- 0x8: y-rotation only
- 0x2: full compressed rotation
- 0x1: animation

## Flag Glossary (Do Not Mix Layers)
### 1) SMSG_UPDATE (guaranteed update stream)
Wire-format flags written by `Server_WriteUpdateEntry` and consumed by `UpdateHandle_GroupObjUpdate`:
- 0x0001 create/full state
- 0x0800 model file block
- 0x0010 scale vector
- 0x0404 rotation
- 0x4202 position/velocity
- 0x0008 object flags block
- 0x0100 attachments
- 0x2020 animation info
- 0x8000 extra LTVector

### 2) SMSG_UNGUARANTEEDUPDATE (fast stream)
4-bit flags per entry:
- 0x4 compressed position (+ optional velocity)
- 0x8 y-rotation only
- 0x2 full compressed rotation
- 0x1 animation

### 3) Preset table flags (Object.lto data)
Preset entries include a 32-bit flags field (observed values: 0x100 / 0x101).
These are **not** network flags. They appear to map to SQL booleans:
- prop_movetofloor
- prop_solid

Evidence: `GameMaster_HandleMessage` SQL dump writes `prop_movetofloor` and `prop_solid` from object bytes +240/+241.

## Update Block Framing (SMSG_UPDATE)
`Server_BuildObjectUpdates` @ 0x10043250 builds variable-sized blocks and prefixes each with a **u32 bit-length**, then appends the block payload. The emulator’s `MSG_UPDATE` implementation mirrors this (per-block length + data). The client validates `consumed_bits == bitlen` per block.

## Client-side Handlers (fom_client.exe / Object.lto)
- `OnUpdatePacket` @ 0x006E6DF0: handles id 8 update blocks.
- `UpdateHandle_GroupObjUpdate` @ 0x006E67C0: applies CF_* flags; spawns objects when CF_NEWOBJECT set.
- `OnUnguaranteedUpdatePacket` @ 0x006E60D0: handles id 0x0A.
- `OnPreloadListPacket` @ 0x004270D0: handles id 19 preload list.

## File ID Mapping (Critical)
This is the missing piece for model/skin/renderstyle IDs. The server does **not** send filenames with SMSG_PRELOADLIST; it only sends file IDs, so the client must already know the **fileId -> filename** mapping.

### Old Client Anchors (Renamed `fom_client.exe`, ida2 @ 13338)
These are **verified** in the older client build (no symbols, so use strings):

- `sub_49A6F0` — sends load/cache-load request
  - Writes packet id **19 (0x13)**, subtype **2 or 6**, then **u16 fileId**.
  - String: `model-rez: send load req fileid(%d) %s`
- `sub_49AA90` — sends preload request
  - Writes packet id **19 (0x13)**, subtype **2 or 6**, then **u16 fileId**.
  - String: `model-rez: send preload req fileid(%d) %s`
- `sub_4A0950` — handles **SMSG_PRELOADLIST (0x13)**
  - Reads subtype byte, then loops **u16 fileId** until end of packet.
  - Strings: `client preload model file-id(%d)` / `...not found`

#### Breakpoints (IDA2)
Set these to capture fileId flow and confirm payloads during a live session:
- `0x49A6F0` (send load/cache-load req)
- `0x49AA90` (send preload req)
- `0x4A0950` (recv preload list; fileIds consumed here)

#### Still Needed
Locate the **STC_FILEDESC (id 50 / 0x32)** handler in this old client:
- Expected payload: `u16 fileId` + `u32 fileSize` + `string filename`.
- Once found, add a breakpoint to capture the fileId->path map as it’s built.

### Current Client Anchors (ida3 @ 13339, same renamed `fom_client.exe`)
These match the old build by pattern and confirm the same fileId flow:

- **Send preload req**: code at `0x4F8D8C`
  - Writes `u16 fileId` with `Packet_WriteBitsN(..., 16)`.
  - String ref: `model-rez: send preload req fileid(%d) %s`.
- **Send load/cache-load req**: code near `0x4F8A3D`
  - String refs: `model-rez: send load req fileid(%d) %s`,
    `model-rez: send cache-load req fileid(%d) %s`.
- **OnPreloadListPacket**: `0x49723A`
  - Reads subtype byte, then loops `Packet_ReadBits(16)` fileIds.
  - Logs: `client preload model file-id(%d)` / `...not found`.

#### FileDesc -> FileId map (client side)
We have the **receiver** for file descriptors via `CClientFileMgr::OnNewFile`:
- Vtable entry: `0x71E97C` → `ClientFileMgr_OnNewFile` at `0x484470`.
- Args observed:
  - `[ebp+0Ch]` = filename (string)
  - `[ebp+14h]` = fileId (u16 stored to server-file entry)
  - (file size appears to be derived from file tree; packet size may be ignored here)
- Behavior:
  - `ClientFileMgr_FindInFileTrees(filename)`
  - If missing: logs **"Unable to find server file: %s"**
  - Else allocates/updates `ServerFile` entry with fileId and path.

This confirms the STC_FILEDESC handler eventually calls `CClientFileMgr::OnNewFile`.

### STC_FILEDESC Receiver (ida2 @ 13338, live debug)
**Handler function:** `sub_66A370` (hit via BP on `ClientFileMgr_OnNewFile`).

Flow (packet id **0x32**):
1) `Packet_ReadBits(8)` → message id, must be **0x32** (else early exit).
2) Loop while data remains:
   - `Packet_ReadBits(16)` → **fileId** (u16)
   - `Packet_ReadBits(32)` → **fileSize** (u32)
   - `Packet_ReadString` (max **0x104** bytes) → **filename**
   - Call `CClientFileMgr::OnNewFile(mgr, filename, fileSize, fileId)`
     - Vtable slot **+0x38** (index 14)
     - Function: `0x702B10` (ida2)
3) If `OnNewFile` returns 0 (file missing), it **sets high bit** on fileId (`fileId |= 0x8000`).
4) Sends **CTS_FILESTATUS** (packet id **0x36**) with the (possibly high‑bit) fileId:
   - `Packet_WriteBitsN(0x36, 8)`
   - `Packet_WriteBitsN(fileId, 16)`

**Call site evidence:** return address `0x66A4A8` inside `sub_66A370`, where it loads vtable entry `[vtable+0x38]` and calls into `0x702B10`.

### Evidence (server.dll + LithTech source)
- `ModelRez_SendPreloadRequest` @ 0x10039F30 (ida4):
  - Writes packet id **19** (SMSG_PRELOADLIST).
  - Writes preload type: `PRELOADTYPE_MODEL` (2) or `PRELOADTYPE_MODEL_CACHED` (6).
  - Writes **u16 fileId** (no filename).
- `IServerFileMgr::AddUsedFile` (LithTech `server_filemgr.cpp`):
  - `m_CurrentFileID` starts at **0** and increments per added file (`m_FileID = m_CurrentFileID++`).
  - Called when server loads/uses a model file; assigns fileId and stores filename/size.
  - Calls `fts_AddFile(...)` for each connected client.
- `fts_AddFile` (LithTech `ftserv.cpp`):
  - Sends `STC_FILEDESC` **(packet id 50)** with:
    - `u16 fileId`
    - `u32 fileSize`
    - `string filename`
  - Clients respond with `CTS_FILESTATUS` **(packet id 54)**, where high bit indicates “I have this file”.
- `CClientFileMgr::OnNewFile` (LithTech `client_filemgr.cpp`):
  - Locates the filename in local resource trees; **no download required**.
  - Creates a `ServerFile` entry with `m_FileID = fileID`.
  - Inserts into `m_ServerFiles[fileID % NUM_CFM_SERVER_FILES]`.

### "Valid" FileId Rule
A fileId is valid **only after** the client has a `ServerFile` entry for it (created by `OnNewFile`).
If you send PRELOAD/UPDATE with unknown IDs, the client cannot resolve the resource.

### Required Message Order (No File Transfer Mode)
Even if we never transfer file bytes, the **descriptor list is still required**:
1) **STC_FILEDESC (id 50)** for each resource (model/skin/renderstyle):
   - `u16 fileId`
   - `u32 fileSize`
   - `string filename`
2) Optional: **CTS_FILESTATUS (id 54)** from client (can be ignored if we never transfer bytes).
3) **SMSG_PRELOADLIST (id 19)** for each resource by `fileId`.
4) **SMSG_UPDATE (id 8)** spawn/updates that reference those `fileId`s.

### Deterministic FileId Strategy (Recommended)
If we are not running server.dll:
1) Build a deterministic list of required resource filenames (from preset table or DB rows).
2) Sort the list and assign `fileId = index` starting at 0 (mirrors `m_CurrentFileID++`).
3) Send `STC_FILEDESC` for the entire list before PRELOAD/UPDATE.
4) Cache the list so fileIds remain stable between runs.

## World Services / Terminals Mapping
World services data lives in `Docs/Database/WorldDB.md`:
- `world_services`
- `world_object_worldservice`
- `world_object_worldservice_sub`

Terminal/world service objects are expected to be spawned as world models (type 1) via SMSG_UPDATE.

### SQL Field Mapping (current best effort)
`world_object_worldservice` (spawn payload for primary terminal object):
- `service_id` (FK)
- `x`, `y`, `z` (position)
- `rotation` (rotation)
- `prop_model` (model filename)
- `prop_textures` (skin list)
- `prop_renderstyle` (renderstyle list)
- `prop_scale` (scale; float, used in update flags 0x0010)
- `prop_movetofloor`, `prop_solid` (likely from preset flags)

`world_object_worldservice_sub` (spawn payload for sub-objects):
- `service_id` (FK)
- `service_type` (subtype)
- `x`, `y`, `z`, `rotation` etc

`world_services` (gameplay state, not direct spawn):
- timers, hacked states, opposing faction, etc.

### Preset Table (Object.lto)
Table base: 0x5AE8BA54 (Object.lto image base 0x5AD50000).
Structure per entry (7 dwords, 28 bytes):
- name string
- service_type (u32)
- model path
- skins list (semicolon-separated)
- renderstyle path
- scale (float)
- flags (u32)

Preset entries (service_type -> resource mapping):
| service_type | name | model | skins | renderstyle | scale | flags |
|---|---|---|---|---|---|---|
| 2 | World Market - Normal | Models\\Props\\Terminals\\marketing_terminal.ltb | skins\\Props\\Terminals\\mt_2_1.dtx;skins\\Props\\Terminals\\mt_2_2.dtx;skins\\Props\\Terminals\\mt_2_3.dtx | RS\\default.ltb | 2.5 | 0x101 |
| 2 | World Market - Rusty 1 | Models\\Props\\Terminals\\marketing_terminal.ltb | skins\\Props\\Terminals\\mt_3_1.dtx;skins\\Props\\Terminals\\mt_3_2.dtx;skins\\Props\\Terminals\\mt_3_3.dtx | RS\\default.ltb | 2.5 | 0x101 |
| 2 | World Market - Rusty 2 | Models\\Props\\Terminals\\marketing_terminal.ltb | skins\\Props\\Terminals\\mt_1_1.dtx;skins\\Props\\Terminals\\mt_1_2.dtx;skins\\Props\\Terminals\\mt_1_3.dtx | RS\\default.ltb | 2.5 | 0x101 |
| 8 | Production Manager | Models\\Props\\Terminals\\productionterminal.ltb | skins\\Props\\Terminals\\production_terminal.dtx | RS\\default.ltb | 1.0 | 0x101 |
| 7 | Medical Station - Normal | Models\\Props\\Terminals\\medic.ltb | skins\\Props\\Terminals\\medic.dtx | RS\\default.ltb | 1.0 | 0x101 |
| 3 | Item Storage | Models\\Props\\Terminals\\storageaccess.ltb | skins\\Props\\Terminals\\storageaccess.dtx | RS\\default.ltb | 1.0 | 0x101 |
| 5 | Apartment Complex - Normal | Models\\Props\\Terminals\\apartment_entry.ltb | skins\\Props\\Terminals\\apartment_entry.dtx | RS\\default.ltb | 1.0 | 0x101 |
| 5 | Apartment Complex - Rusty | Models\\Props\\Terminals\\apartment_entry.ltb | skins\\Props\\Terminals\\apartment_entry2.dtx | RS\\default.ltb | 1.0 | 0x101 |
| 4 | Chemical Refinery | Models\\Props\\Terminals\\chemlab.ltb | skins\\Props\\Terminals\\chemlab.dtx | RS\\default.ltb | 1.2 | 0x101 |
| 9 | Schematic Market | Models\\Props\\Terminals\\marketing_terminal.ltb | skins\\Props\\Terminals\\mt_1_1.dtx;skins\\Props\\Terminals\\mt_1_2.dtx;skins\\Props\\Terminals\\mt_1_3.dtx | RS\\default.ltb | 2.5 | 0x101 |
| 10 | Removed | None | None | RS\\default.ltb | 1.0 | 0x101 |
| 1 | Repair Station | Models\\Props\\Terminals\\nf_terminal1.ltb | skins\\Props\\Terminals\\nf_terminal1_normal.dtx;skins\\Props\\Terminals\\nf_terminal1.dtx | RS\\Dot3bump_2pass.ltb | 8.0 | 0x101 |
| 11 | Recycle Station | Models\\Props\\Terminals\\nf_terminal2.ltb | skins\\Props\\Terminals\\nf_terminal2_normal.dtx;skins\\Props\\Terminals\\nf_terminal2.dtx | RS\\Dot3bump_2pass.ltb | 5.5 | 0x101 |
| 12 | Vortex Network - Normal | Models\\Props\\Terminals\\portal_terminal.ltb | skins\\Props\\Terminals\\portal_0.dtx | RS\\default.ltb | 1.7 | 0x101 |
| 12 | Vortex Network - Rusty Green | Models\\Props\\Terminals\\portal_terminal.ltb | skins\\Props\\Terminals\\portal2_0.dtx | RS\\default.ltb | 1.7 | 0x101 |
| 12 | Vortex Network - Rusty Red | Models\\Props\\Terminals\\portal_terminal.ltb | skins\\Props\\Terminals\\portal3_0.dtx | RS\\default.ltb | 1.7 | 0x101 |
| 12 | Vortex Network - Cloning | Models\\Props\\Terminals\\portal_terminal.ltb | skins\\Props\\Terminals\\clportal_0.dtx | RS\\default.ltb | 1.7 | 0x101 |
| 6 | Prison Control | Models\\Props\\Terminals\\colony_control.ltb | skins\\Props\\Terminals\\colony_control.dtx | RS\\default.ltb | 1.0 | 0x101 |
| 13 | Removed2 | Models\\Props\\Terminals\\storageaccess.ltb | skins\\Props\\Terminals\\storageaccess.dtx | RS\\default.ltb | 1.0 | 0x101 |
| 14 | Standard Market | Models\\Props\\Terminals\\marketing_terminal.ltb | skins\\Props\\Terminals\\mt_1_1.dtx;skins\\Props\\Terminals\\mt_1_2.dtx;skins\\Props\\Terminals\\mt_1_3.dtx | RS\\default.ltb | 2.5 | 0x101 |
| 15 | Clothing Market | Models\\Props\\Terminals\\marketing_terminal.ltb | skins\\Props\\Terminals\\mt_1_1.dtx;skins\\Props\\Terminals\\mt_1_2.dtx;skins\\Props\\Terminals\\mt_1_3.dtx | RS\\default.ltb | 2.5 | 0x101 |

### Subobject Presets (world_object_worldservice_sub)
Table base: 0x5AE8BE38.
Structure matches main preset entries:
| service_type | name | model | skins | renderstyle | scale | flags |
|---|---|---|---|---|---|---|
| 0 | Prison - Mineral Collector | Models\\Props\\Terminals\\mining.ltb | skins\\Props\\Terminals\\mining.dtx | RS\\default.ltb | 1.0 | 0x101 |
| 1 | Prison - Bail Manager | Models/Props/Terminals/repunit.ltb | Skins/Props/Terminals/repunit.dtx | RS\\default.ltb | 1.0 | 0x101 |
| 2 | Barrier Switch | Models/Props/Terminals/barrierswitch.ltb | Tex/RebirthWM/barrierconsole_d.dtx | RS\\default.ltb | 1.0 | 0x100 |

## Resource Preload List
`Docs/WorldServiceResourceList.csv` is the authoritative list of paths for FileIdMap generation.
Use those exact strings when building file descriptors and preload lists.

## DB -> Packet Process (World Services)
1) Query `world_services` by `world_id` and join object tables.
2) For each service, resolve resources:
   - Use explicit DB fields if populated.
   - Else use preset table by `service_type`.
3) Build deterministic fileId map for all resources (models/skins/renderstyles) and send STC_FILEDESC.
4) Send SMSG_PRELOADLIST for those fileIds.
5) Spawn objects via SMSG_UPDATE (create/full state + model block + flags + scale).
6) Spawn subobjects (world_object_worldservice_sub) after parent, using subobject preset table.
7) Later updates (position/rotation) use SMSG_UPDATE with minimal flags.

## Validation Checklist
- Client receives STC_FILEDESC and accepts fileIds (no missing resource warnings).
- SMSG_PRELOADLIST loads resources (look for preload logs).
- SMSG_UPDATE spawns terminals at expected positions.
- Object flags (solid/movetofloor) behave correctly.

## Open Questions / TODO
- Confirm exact client-side storage for fileId map in FoM (likely `CClientFileMgr::m_ServerFiles`).
- Confirm any game-specific overrides of LithTech file transfer packet IDs.
- Verify whether `Removed` entries (service_type 10/13) are unused or legacy.

## Revision History
- 2026-01-12: Rebuilt document; added fileId mapping rules, message order, and deterministic fileId strategy.
- 2026-01-12: Added full world service preset and subobject preset tables from Object.lto.
