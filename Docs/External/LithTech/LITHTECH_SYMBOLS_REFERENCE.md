# LithTech Source Reference - Key Symbols for FoM RE

## Overview
This document catalogs key class names, struct definitions, and function signatures from the LithTech Jupiter engine source code (External/LithTech/). These symbols are critical for reverse engineering the FoM client binaries (fom_client.exe, CShell.dll, CRes.dll).

---

## 1. CLIENT SHELL ARCHITECTURE

### Core Client Shell Classes
- **CClientShell** - Main client shell connection handler
  - Location: `engine/runtime/client/src/clientshell.h`
  - Key methods: `Init()`, `Term()`, `StartupClient()`, `Update()`, `Render()`
  - Manages world loading, object creation, packet processing
  - Inherits from: `CNetHandler`

- **IClientShell** - Client shell interface (game-side callback interface)
  - Location: `engine/sdk/inc/iclientshell.h`
  - Key callbacks: `PreUpdate()`, `Update()`, `PostUpdate()`, `OnEngineInitialized()`, `OnEngineTerm()`
  - Handles collision, object rotation, console printing

- **GameClientShell** - Game-specific client shell implementation
  - Location: `game/clientshelldll/clientshellshared/gameclientshell.h`
  - Extends IClientShell with game-specific logic

### Client Manager
- **CClientMgr** - Manages multiple client connections
  - Location: `engine/runtime/client/src/clientmgr.h`
  - Maintains list of active CClientShell instances

---

## 2. MESSAGE & PACKET SYSTEM

### Message Interfaces (ILTMessage_*)
- **ILTMessage_Write** - Write-side message interface
  - Location: `engine/sdk/inc/iltmessage.h`
  - Key methods:
    - `WriteBits(uint32 nValue, uint32 nSize)` - Write arbitrary bit count
    - `WriteBits64(uint64 nValue, uint32 nSize)` - 64-bit write
    - `WriteData(const void *pData, uint32 nSize)` - Raw data write
    - `WriteString(const char *pString)` - String write
    - `WriteCompLTVector()`, `WriteCompLTRotation()` - Compressed spatial data
    - `WriteObject(HOBJECT hObj)` - Object handle write
    - `WriteMessage()`, `WriteMessageRaw()` - Nested message write

- **ILTMessage_Read** - Read-side message interface
  - Location: `engine/sdk/inc/iltmessage.h`
  - Key methods:
    - `ReadBits(uint32 nBits)` - Read arbitrary bit count
    - `ReadBits64(uint32 nBits)` - 64-bit read
    - `ReadData(void *pData, uint32 nBits)` - Raw data read
    - `ReadString(char *pDest, uint32 nMaxLen)` - String read
    - `ReadCompLTVector()`, `ReadCompLTRotation()` - Compressed spatial data
    - `ReadObject()` - Object handle read
    - `ReadMessage()` - Nested message read
    - `Seek()`, `SeekTo()`, `Tell()`, `TellEnd()`, `EOM()` - Position control
    - `PeekBits()`, `PeekData()`, `PeekString()` - Non-destructive read

### Message Implementation Classes
- **CLTMessage_Write** - Concrete write message implementation
  - Location: `engine/runtime/shared/src/ltmessage.h`
  - Wraps `CPacket_Write` internally

- **CLTMessage_Read** - Concrete read message implementation
  - Location: `engine/runtime/shared/src/ltmessage.h`
  - Wraps `CPacket_Read` internally

### Packet Classes
- **CPacket_Write** - Low-level packet writing
  - Location: `engine/runtime/kernel/net/src/packet.h`
  - Manages bit-level writing to packet buffer

- **CPacket_Read** - Low-level packet reading
  - Location: `engine/runtime/kernel/net/src/packet.h`
  - Manages bit-level reading from packet buffer

- **CPacket_Data** - Internal packet data storage
  - Location: `engine/runtime/kernel/net/src/packet.h`
  - Chunk-based storage for packet data
  - Reference counted

---

## 3. PACKET DEFINITIONS (Server->Client)

### Protocol Version
- **SMSG_NETPROTOCOLVERSION** (0x04) - Protocol version handshake
- **LT_NET_PROTOCOL_VERSION** = 7 (LithTech 3.0)

### Core Server Messages (SMSG_*)
- **SMSG_YOURID** (0x0C) - Client ID assignment
  - Data: uint16 clientID, uint8 bLocal

- **SMSG_CLIENTOBJECTID** (0x07) - Player object ID
  - Data: uint16 objectID

- **SMSG_LOADWORLD** (0x06) - Load world
  - Data: float gameTime, uint16 worldFileID

- **SMSG_UNLOADWORLD** (0x05) - Unload world

- **SMSG_UPDATE** (0x08) - Guaranteed object updates
  - Contains object creation/modification data
  - Uses CF_* flags for object properties

- **SMSG_UNGUARANTEEDUPDATE** (0x0A) - Position/rotation updates
  - Lightweight, unreliable updates
  - Uses UUF_* flags (UUF_POS, UUF_ROT, UUF_YROTATION, UUF_ANIMINFO)

- **SMSG_PACKETGROUP** (0x0E) - Grouped unguaranteed packets
  - Multiple small packets bundled together

- **SMSG_MESSAGE** (0x0D) - Game message
  - Arbitrary message data

- **SMSG_CONSOLEVAR** (0x0F) - Console variable
  - Data: STRING varName, STRING varData

- **SMSG_PRELOADLIST** (0x11) - Resource preload list
  - Data: uint8 type (PRELOADTYPE_*), uint16 fileID

### Packet Definitions Header
- Location: `engine/runtime/shared/src/packetdefs.h`
- Defines all SMSG_* and CMSG_* packet IDs
- Defines compression constants (NUM_POSITION_BITS_*, NUM_EXTRA_BITS_*)

---

## 4. NETWORK MANAGEMENT

### Network Manager
- **CNetMgr** - Core network manager
  - Location: `engine/runtime/kernel/net/src/netmgr.h`
  - Manages connections, packet queuing, bandwidth tracking

- **CBaseDriver** - Network driver base class
  - Location: `engine/runtime/kernel/net/src/netmgr.h`
  - Implementations: TCP/IP, DirectPlay, RakNet

- **CBaseConn** - Network connection base class
  - Location: `engine/runtime/kernel/net/src/netmgr.h`
  - Key methods:
    - `GetIPAddress(uint8 pAddr[4], uint16 *pPort)` - Get peer address
    - `GetPing()` - Get latency
    - `GetBandwidth()`, `SetBandwidth()` - Bandwidth control
    - `GetPacketLoss()` - Packet loss percentage
  - Tracks: SendBPS, SendPPS, RecvBPS, RecvPPS (RateTracker)

### Packet Queuing
- **CQueuedPacket** - Queued packet wrapper
  - Location: `engine/runtime/kernel/net/src/netmgr.h`
  - Fields: `CPacket_Read m_cPacket`, `bool m_bGuaranteed`

- **LatentPacket** - Delayed packet for resend
  - Location: `engine/runtime/kernel/net/src/netmgr.h`
  - Fields: `float m_SendTimeCounter`, `CPacket_Read m_cPacket`, `uint32 m_nPacketFlags`

---

## 5. OBJECT & WORLD SYSTEM

### Object Management
- **LTObject** - Base object structure
  - Location: `engine/runtime/shared/src/objectmgr.h`
  - Represents any world entity (player, NPC, item, etc.)

- **ObjectCreateStruct** - Object creation parameters
  - Location: `engine/sdk/inc/iltclient.h`
  - Contains initial object properties

- **MoveObject** - Movement-enabled object
  - Location: `engine/runtime/shared/src/moveobject.h`
  - Handles physics, velocity, acceleration

### World System
- **WorldBsp** - Binary space partition tree
  - Location: `engine/runtime/world/src/de_world.h`
  - Spatial acceleration structure

- **IWorldClientBSP** - Client-side BSP interface
  - Location: `engine/runtime/client/src/world_client_bsp.h`

- **IWorldSharedBSP** - Shared BSP interface
  - Location: `engine/runtime/world/src/world_shared_bsp.h`

- **FileIdentifier** - World file reference
  - Location: `engine/runtime/client/src/clientshell.h`

---

## 6. CORE INTERFACES (ILT*)

### Client Interface
- **ILTClient** - Main client engine interface
  - Location: `engine/sdk/inc/iltclient.h`
  - Provides access to all client subsystems
  - Key subsystems:
    - ILTModel - Model/animation system
    - ILTPhysics - Physics system
    - ILTVideoMgr - Video/rendering
    - ILTSoundMgr - Audio system
    - ILTTransform - Object transformation
    - ILTDrawPrim - Primitive drawing
    - ILTFontManager - Font rendering
    - ILTWidgetManager - UI widgets

### Common Interfaces
- **ILTCommon** - Common engine interface
  - Location: `engine/sdk/inc/iltcommon.h`
  - Base functionality shared by client/server

- **ILTCSBase** - Client/Server base interface
  - Location: `engine/sdk/inc/iltcsbase.h`

### Stream Interface
- **ILTStream** - Data stream interface
  - Location: `engine/sdk/inc/iltstream.h`
  - Used for file I/O and data serialization

---

## 7. OBJECT CREATION & UPDATES

### Object Creation Flags (CF_*)
- **CF_MODELINFO** - Model/animation data
- **CF_RENDERINFO** - Rendering properties
- **CF_ATTACHMENTS** - Attachment points
- **CF_DIMS** - Dimensions/bounding box
- **CF_COLORINFO** - C
