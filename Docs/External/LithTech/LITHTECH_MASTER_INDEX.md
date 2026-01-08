# LithTech Source Reference - Master Index for FoM RE

**Generated**: 2026-01-07  
**Total LithTech Files**: 3,819 (2,250 headers, 1,569 cpp files)  
**Focus**: Client shell, messaging, networking, object system

---

## Quick Navigation

### 1. **LITHTECH_COMPREHENSIVE_REFERENCE.md** (215 lines)
**Most Important** - Complete symbol catalog with all key classes, methods, and constants
- CClientShell architecture
- ILTMessage_Write/Read interfaces
- Packet definitions (SMSG_*)
- Object creation flags (CF_*)
- Update flags (UUF_*)
- Network management (CNetMgr, CBaseConn)
- Core interfaces (ILTClient, ILTCommon)
- Math structures (LTVector, LTRotation)
- Disconnect reasons, preload types, constants
- RE strategy and symbol search patterns

**Start here for RE work**

---

### 2. **LITHTECH_SYMBOLS_REFERENCE.md** (230 lines)
**Detailed Symbol Reference** - Organized by functional category
- 19 sections covering all major systems
- File locations for each symbol
- Cross-reference tips
- Related external references
- Notes for reverse engineers

**Use for detailed lookups**

---

### 3. **LITHTECH_FILES_INVENTORY.txt** (226 lines)
**Complete File Listing** - All 3,819 files organized by priority
- Priority 1: Client shell & messaging (CRITICAL)
- Priority 2: Message & packet system
- Priority 3: Network management
- Priority 4: Object & world system
- Priority 5: Core interfaces
- Priority 6-13: Supporting systems
- Secondary: Game-specific implementations
- Tertiary: Supporting libraries

**Use for file location reference**

---

## Key Files to Read First

### MUST READ (In Order)
1. `engine/runtime/client/src/clientshell.h` - CClientShell class definition
2. `engine/sdk/inc/iclientshell.h` - IClientShell callback interface
3. `engine/sdk/inc/iltmessage.h` - Message read/write API
4. `engine/runtime/shared/src/packetdefs.h` - All packet ID definitions
5. `engine/runtime/kernel/net/src/netmgr.h` - Network management
6. `engine/runtime/kernel/net/src/packet.h` - Low-level packet handling
7. `game/clientshelldll/clientshellshared/gameclientshell.h` - Game-specific shell

### SHOULD READ (For Context)
8. `engine/sdk/inc/iltclient.h` - Main client interface
9. `engine/runtime/world/src/de_world.h` - World system
10. `engine/runtime/shared/src/objectmgr.h` - Object management
11. `engine/sdk/inc/ltvector.h` - Vector math
12. `engine/sdk/inc/ltrotation.h` - Rotation math

---

## Critical Packet IDs (Search for These)

```
0x04 = SMSG_NETPROTOCOLVERSION   (Protocol version)
0x05 = SMSG_UNLOADWORLD          (Unload world)
0x06 = SMSG_LOADWORLD            (Load world)
0x07 = SMSG_CLIENTOBJECTID       (Player object ID)
0x08 = SMSG_UPDATE               (Guaranteed updates)
0x0A = SMSG_UNGUARANTEEDUPDATE   (Position/rotation)
0x0C = SMSG_YOURID               (Client ID assignment)
0x0D = SMSG_MESSAGE              (Game message)
0x0E = SMSG_PACKETGROUP          (Grouped packets)
0x0F = SMSG_CONSOLEVAR           (Console variable)
0x11 = SMSG_PRELOADLIST          (Resource preload)
```

When reverse engineering FoM binaries, search for these hex values to find packet handlers.

---

## Critical Message Methods (Search for These)

```
ReadBits()              - Read N bits from message
WriteBits()             - Write N bits to message
ReadString()            - Read null-terminated string
WriteString()           - Write null-terminated string
ReadCompLTVector()      - Read compressed 3D vector
WriteCompLTVector()     - Write compressed 3D vector
ReadCompLTRotation()    - Read compressed rotation
WriteCompLTRotation()   - Write compressed rotation
ReadObject()            - Read object handle
WriteObject()           - Write object handle
ReadMessage()           - Read nested message
WriteMessage()          - Write nested message
Seek()                  - Seek in message
SeekTo()                - Seek to position
Tell()                  - Get read position
EOM()                   - At end of message?
```

These methods appear in packet parsing code throughout the client.

---

## Critical Network Methods (Search for These)

```
NewConnectionNotify()       - New connection callback
DisconnectNotify()          - Disconnect callback
HandleUnknownPacket()       - Unknown packet handler
ProcessPackets()            - Main packet processing
ProcessPacket()             - Single packet handler
SendPacketToServer()        - Send packet to server
GetIPAddress()              - Get peer IP/port
GetPing()                   - Get latency
GetBandwidth()              - Get bandwidth limit
SetBandwidth()              - Set bandwidth limit
GetPacketLoss()             - Get packet loss %
```

These methods are part of the network handler interface.

---

## Critical Object Flags (Search for These)

### Object Creation Flags (CF_*)
```
CF_MODELINFO        - Model/animation data
CF_RENDERINFO       - Rendering properties
CF_ATTACHMENTS      - Attachment points
CF_DIMS             - Dimensions/bounding box
CF_COLORINFO        - Color/transparency
CF_LIGHTMAP         - Lightmap data
CF_PHYSICS          - Physics properties
CF_VELOCITY         - Velocity vector
CF_ROTATION         - Rotation quaternion
CF_POSITION         - Position vector
CF_SCALE            - Scale factor
CF_ANIMINFO         - Animation state
CF_SOUNDINFO        - Sound properties
```

These flags appear in SMSG_UPDATE packet parsing.

### Update Flags (UUF_*)
```
0x1 = UUF_ANIMINFO      - Animation info included
0x2 = UUF_ROT           - Rotation included
0x4 = UUF_POS           - Position included
0x8 = UUF_YROTATION     - Y-rotation only (1 byte)
```

These flags appear in SMSG_UNGUARANTEEDUPDATE packet parsing.

---

## Position Compression Details

```
X: 19 bits (16 + 3 extra)
Y: 18 bits (16 + 2 extra)
Z: 19 bits (16 + 3 extra)
Total: 56 bits (7 bytes)

Provides 256k resolution instead of 65k
```

When you see 56-bit position reads, this is the compression scheme.

---

## Reverse Engineering Workflow

### Step 1: Locate Packet Handlers
- Search for packet ID constants (0x04-0x11)
- Find switch statement or if-else chain
- Identify handler function for each packet type

### Step 2: Trace Message Reading
- Find calls to ReadBits(), ReadString(), etc.
- Map to LithTech message API
- Identify packet structure

### Step 3: Understand Object Creation
- Find CF_* flag checks
- Trace object property parsing
- Map to ObjectCreateStruct fields

### Step 4: Understand Updates
- Find UUF_* flag checks
- Trace position/rotation decompression
- Map to LTVector/LTRotation structures

### Step 5: Map Network Flow
- Find CBaseConn usage
- Trace packet sending/receiving
- Identify bandwidth/ping tracking

---

## Key Constants

```cpp
LT_NET_PROTOCOL_VERSION = 7        // Protocol version
DEFAULT_CLIENT_UPDATE_RATE = 10     // Update rate (Hz)
SYNCPACKET_FREQUENCY = 30           // Sync packet frequency
DRIVER_PADDING = 2                  // Packet padding bytes
ID_MAX = 0xFFFE                     // Max object ID
ID_TIMESTAMP = 0xFFFF               // Timestamp marker
INVALID_CONNID = NULL               // Invalid connection
NUM_POSITION_BITS_X = 19            // Position X bits
NUM_POSITION_BITS_Y = 18            // Position Y bits
NUM_POSITION_BITS_Z = 19            // Position Z bits
```

---

## Disconnect Reasons

```cpp
0 = DISCONNECTREASON_VOLUNTARY_CLIENTSIDE
1 = DISCONNECTREASON_LOCALDRIVER
2 = DISCONNECTREASON_CONNFLAG_FORCEDISCONNECT
3 = DISCONNECTREASON_DEAD
4 = DISCONNECTREASON_SHUTDOWN
5 = DISCONNECTREASON_VOLUNTARY_SERVERSIDE
6 = DISCONNECTREASON_KICKED
```

---

## Preload Types

```cpp
0 = PRELOADTYPE_START           // Start of preload list
1 = PRELOADTYPE_END             // End of preload list
2 = PRELOADTYPE_MODEL           // Model file
3 = PRELOADTYPE_TEXTURE         // Texture file
4 = PRELOADTYPE_SPRITE          // Sprite file
5 = PRELOADTYPE_SOUND           // Sound file
6 = PRELOADTYPE_MODEL_CACHED    // Cached model
```

---

## File Organization in External/LithTech

```
External/LithTech/
├── engine/
│   ├── runtime/
│   │   ├── client/src/          ← CLIENT SHELL (CRITICAL)
│   │   ├── shared/src/          ← PACKET DEFS, MESSAGES
