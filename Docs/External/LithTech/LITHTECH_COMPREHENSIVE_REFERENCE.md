# LithTech Source Reference - Comprehensive Symbol Catalog for FoM RE

**Total Files**: 3,819 (2,250 headers, 1,569 cpp files)

---

## SECTION 1: CLIENT SHELL ARCHITECTURE

### CClientShell (Core Connection Handler)
**File**: `engine/runtime/client/src/clientshell.h`
**Key Methods**:
- `Init()` - Initialize shell
- `Term()` - Terminate shell
- `StartupClient(CBaseDriver *pDriver)` - Connect to server
- `Update()` - Main update loop
- `Render(CameraInstance *pCamera)` - Render frame
- `ProcessPackets()` - Handle incoming packets
- `ProcessPacket(const CPacket_Read &)` - Process single packet
- `SendPacketToServer(const CPacket_Read &cPacket)` - Send packet
- `SendCommandToServer(char *pCommand)` - Send console command
- `DoLoadWorld(const CPacket_Read &cPacket, bool bLocal)` - Load world
- `CreateVisContainerObjects()` - Create world objects
- `BindWorlds()` / `UnbindWorlds()` - Bind/unbind world BSP

**Key Members**:
- `uint16 m_ClientID` - Client ID from server
- `CBaseConn *m_HostID` - Server connection
- `CBaseDriver *m_pDriver` - Network driver
- `bool m_bOnServer` - Connected flag
- `uint16 m_ClientObjectID` - Player object ID
- `float m_GameTime` - Server game time
- `float m_ClientGameTime` - Client-side game time
- `LTLink m_MovingObjects` - Moving object list
- `LTLink m_RotatingObjects` - Rotating object list

**Inherits From**: `CNetHandler`

---

### IClientShell (Game Callback Interface)
**File**: `engine/sdk/inc/iclientshell.h`
**Key Callbacks**:
- `PreUpdate()` - Called before Update()
- `Update()` - Main game update
- `PostUpdate()` - Called after Update()
- `OnEngineInitialized(RMode *pMode, LTGUID *pAppGuid)` - Engine ready
- `OnEngineTerm()` - Engine shutting down
- `OnEvent(uint32 dwEventID, uint32 dwParam)` - Engine event
- `OnObjectRotate(HLOCALOBJ hObj, bool bTeleport, LTRotation *pNewRot)` - Object rotation
- `OnConsolePrint(CConsolePrintData *pData)` - Console output
- `OnTouchNotify(HLOCALOBJ hMain, CollisionInfo *pInfo, float forceMag)` - Collision

---

### GameClientShell (Game-Specific Implementation)
**File**: `game/clientshelldll/clientshellshared/gameclientshell.h`
**Extends**: `IClientShell`
**Purpose**: Game-specific client shell logic (FoM would have similar structure)

---

## SECTION 2: MESSAGE & PACKET SYSTEM

### ILTMessage_Write (Write Interface)
**File**: `engine/sdk/inc/iltmessage.h`
**Key Methods**:
```cpp
void WriteBits(uint32 nValue, uint32 nSize)           // Write N bits
void WriteBits64(uint64 nValue, uint32 nSize)         // Write 64-bit value
void WriteData(const void *pData, uint32 nSize)       // Write raw data
void WriteString(const char *pString)                 // Write null-terminated string
void WriteCompLTVector(const LTVector &vVec)          // Write compressed 3D vector
void WriteCompLTRotation(const LTRotation &cRotation) // Write compressed rotation
void WriteCompPos(const LTVector &vPos)               // Write compressed position
void WriteObject(HOBJECT hObj)                        // Write object handle
void WriteMessage(const ILTMessage_Read *pMsg)        // Write nested message
void WriteYRotation(const LTRotation &cRotation)      // Write Y-only rotation
```

**Convenience Methods**:
```cpp
void Writebool(bool bValue)           // Write 1 bit
void Writeuint8(uint8 nValue)         // Write 8 bits
void Writeuint16(uint16 nValue)       // Write 16 bits
void Writeuint32(uint32 nValue)       // Write 32 bits
void Writeuint64(uint64 nValue)       // Write 64 bits
void Writefloat(float fValue)         // Write 32-bit float
void WriteLTVector(const LTVector &v) // Write full vector
void WriteLTRotation(const LTRotation &c) // Write full rotation
```

---

### ILTMessage_Read (Read Interface)
**File**: `engine/sdk/inc/iltmessage.h`
**Key Methods**:
```cpp
uint32 ReadBits(uint32 nBits)                         // Read N bits
uint64 ReadBits64(uint32 nBits)                       // Read 64-bit value
void ReadData(void *pData, uint32 nBits)              // Read raw data
uint32 ReadString(char *pDest, uint32 nMaxLen)        // Read null-terminated string
LTVector ReadCompLTVector()                           // Read compressed vector
LTVector ReadCompPos()                                // Read compressed position
LTRotation ReadCompLTRotation()                       // Read compressed rotation
HOBJECT ReadObject()                                  // Read object handle
ILTMessage_Read *ReadMessage()                        // Read nested message
LTRotation ReadYRotation()                            // Read Y-only rotation
```

**Position Control**:
```cpp
void Seek(int32 nOffset)              // Seek relative to current position
void SeekTo(uint32 nPos)              // Seek to absolute position
uint32 Tell() const                   // Get current read position
uint32 TellEnd() const                // Get position from end
bool EOM() const                      // At end of message?
```

**Peek Methods** (non-destructive read):
```cpp
uint32 PeekBits(uint32 nBits) const
uint64 PeekBits64(uint32 nBits) const
void PeekData(void *pData, uint32 nBits) const
uint32 PeekString(char *pDest, uint32 nMaxLen) const
LTVector PeekCompLTVector() const
LTRotation PeekCompLTRotation() const
HOBJECT PeekObject() const
```

---

### CPacket_Write & CPacket_Read (Low-Level Packet)
**File**: `engine/runtime/kernel/net/src/packet.h`
**Purpose**: Bit-level packet manipulation
**Key Methods**:
- `WriteBits()` - Write arbitrary bits
- `ReadBits()` - Read arbitrary bits
- `WriteString()` - Write string
- `ReadString()` - Read string
- `Size()` - Get packet size in bits
- `Reset()` - Clear packet
- `Seek()`, `SeekTo()`, `Tell()` - Position control

---

## SECTION 3: PACKET DEFINITIONS

### Server->Client Packets (SMSG_*)
**File**: `engine/runtime/shared/src/packetdefs.h`

```cpp
#define SMSG_NETPROTOCOLVERSION    0x04  // Protocol version (4)
#define SMSG_UNLOADWORLD           0x05  // Unload world
#define SMSG_LOADWORLD             0x06  // Load world (float gameTime, uint16 worldFileID)
#define SMSG_CLIENTOBJECTID        0x07  // Set player object ID (uint16 objectID)
#define SMSG_UPDATE                0x08  // Guaranteed object updates
#define SMSG_UNGUARANTEEDUPDATE    0x0A  // Position/rotation updates (unreliable)
#define SMSG_YOURID                0x0C  // Client ID assignment (uint16 clientID, uint8 bLocal)
#define SMSG_MESSAGE               0x0D  // Game message (arbitrary data)
#define SMSG_PACKETGROUP           0x0E  // Grouped unguaranteed packets
#define SMSG_CONSOLEVAR            0x0F  // Console variable (STRING name, STRING value)
#define SMSG_PRELOADLIST           0x11  // Preload resources (uint8 type, uint16 fileID)
#define SMSG_INSTANTSPECIALEFFECT  0x0D  // Instant special effect
#define SMSG_SKYDEF                0x0C  // Sky definition
```

### Protocol Version
```cpp
#define LT_NET_PROTOCOL_VERSION    7     // LithTech 3.0 (spring 2001)
```

---

## SECTION 4: OBJECT CREATION FLAGS (CF_*)

**File**: `engine/runtime/shared/src/packetdefs.h`

Used in SMSG_UPDATE packets to indicate which object properties are included:

```cpp
CF_MODELINFO        // Model/animation data
CF_RENDERINFO       // Rendering properties (color, transparency)
CF_ATTACHMENTS      // Attachment points
CF_DIMS             // Dimensions/bounding box
CF_COLORINFO        // Color/transparency info
CF_LIGHTMAP         // Lightmap data
CF_PHYSICS          // Physics properties
CF_VELOCITY         // Velocity vector
CF_ROTATION         // Rotation quaternion
CF_POSITION         // Position vector
CF_SCALE            // Scale factor
CF_ANIMINFO         // Animation state
CF_SOUNDINFO        // Sound properties
```

---

## SECTION 5: UPDATE FLAGS (UUF_*)

**File**: `engine/runtime/shared/src/packetdefs.h`

Used in SMSG_UNGUARANTEEDUPDATE packets:

```cpp
#define UUF_POS         0x4   // Position included
#define UUF_ROT         0x2   // Rotation included
#define UUF_ANIMINFO    0x1   // Animation info included
#define UUF_YROTATION   0x8   // Y-rotation only (1 byte instead of full rotation)
```

---

## SECTION 6: POSITION COMPRESSION

**File**: `engin
