# LithTech Source Code Index

## Quick Reference

### Core Classes

| Class | Location | Purpose |
|-------|----------|---------|
| **CClientShell** | `engine/runtime/client/src/clientshell.h` | Main client connection handler, implements CNetHandler |
| **CNetHandler** | `engine/runtime/kernel/net/src/netmgr.h` | Abstract base for network event handlers |
| **CNetMgr** | `engine/runtime/kernel/net/src/netmgr.h` | Network manager, coordinates drivers and connections |
| **CBaseDriver** | `engine/runtime/kernel/net/src/netmgr.h` | Abstract base for network drivers |
| **CBaseConn** | `engine/runtime/kernel/net/src/netmgr.h` | Base connection class with bandwidth tracking |

### Message Classes

| Class | Location | Purpose |
|-------|----------|---------|
| **ILTMessage_Write** | `engine/sdk/inc/iltmessage.h` | Abstract interface for message writing |
| **ILTMessage_Read** | `engine/sdk/inc/iltmessage.h` | Abstract interface for message reading |
| **CLTMessage_Write** | `engine/runtime/shared/src/ltmessage.h` | Base implementation for message writing |
| **CLTMessage_Read** | `engine/runtime/shared/src/ltmessage.h` | Base implementation for message reading |
| **CLTMessage_Write_Client** | `engine/runtime/client/src/ltmessage_client.h` | Client-specific message writer |
| **CLTMessage_Read_Client** | `engine/runtime/client/src/ltmessage_client.h` | Client-specific message reader |

### Packet Classes

| Class | Location | Purpose |
|-------|----------|---------|
| **CPacket_Write** | `engine/runtime/kernel/net/src/packet.h` | Bitstream writer with bit-level granularity |
| **CPacket_Read** | `engine/runtime/kernel/net/src/packet.h` | Bitstream reader with peek support |
| **CPacket_Data** | `engine/runtime/kernel/net/src/packet.h` | Internal chunked storage (reference counted) |

### Interface Classes

| Class | Location | Purpose |
|-------|----------|---------|
| **IClientShell** | `engine/sdk/inc/iclientshell.h` | Abstract interface for game client callbacks |

## File Locations

### Client Runtime
```
engine/runtime/client/src/
├── clientshell.h          (218 lines) - CClientShell class
├── clientmgr.h            - Client manager
├── ltmessage_client.h     (86 lines) - Client message implementations
├── console.h              - Console interface
├── predict.h              - Prediction system
├── setupobject.h          - Object setup
└── ... (37 total header files)
```

### Shared Runtime
```
engine/runtime/shared/src/
├── ltmessage.h            (158 lines) - Base message implementations
├── packet.h               (640 lines) - Packet read/write classes
├── bdefs.h                - Base definitions
├── classbind.h            - Class binding
├── compress.h             - Compression utilities
├── concommand.h           - Console commands
├── dhashtable.h           - Hash table
├── dtxmgr.h               - Texture manager
├── findobj.h              - Object finding
├── ftbase.h               - File transfer base
├── ftclient.h             - Client file transfer
├── ftserv.h               - Server file transfer
├── gamemath.h             - Game math utilities
└── ... (20+ total header files)
```

### Network Kernel
```
engine/runtime/kernel/net/src/
├── netmgr.h               (350+ lines) - Network manager, handlers, connections
├── packet.h               (640 lines) - Packet classes
├── localdriver.h          - Local driver
├── syssocket.h            - Socket interface
├── sysudpdriver.h         - UDP driver
├── sysudpthread.h         - UDP thread
└── sys/win/
    ├── udpdriver.h        - Windows UDP driver
    ├── socket.h           - Windows socket
    └── win32_ltthread.h   - Windows threading
```

### SDK Interfaces
```
engine/sdk/inc/
├── iltmessage.h           (150+ lines) - Message interfaces
├── iclientshell.h         (100+ lines) - Client shell interface
├── iservershell.h         - Server shell interface
├── iltbaseclass.h         - Base class interface
├── iltclient.h            - Client interface
├── iltcommon.h            - Common interface
├── iltcsbase.h            - Client/server base
├── iltrefcount.h          - Reference counting
├── ltbasedefs.h           - Base type definitions
├── ltmodule.h             - Module interface
└── ... (40+ total header files)
```

### Client FX
```
engine/clientfx/
├── clientfx.h             - Client effects base
├── basefx.cpp             - Base effect implementation
├── bouncychunkfx.h        - Bouncing chunk effect
├── camjitterfx.h          - Camera jitter effect
├── camwobblefx.h          - Camera wobble effect
├── dynalightfx.h          - Dynamic light effect
├── fallingstufffx.h       - Falling stuff effect
├── flarespritefx.h        - Flare sprite effect
├── lightningfx.h          - Lightning effect
└── ... (20+ effect types)
```

## Method Signatures by Category

### Connection Management
```cpp
// CClientShell
bool Init()
void Term()
LTRESULT StartupClient(CBaseDriver *pDriver)
LTRESULT StartupLocal(StartGameRequest *pRequest, bool bHost, CBaseDriver *pServerDriver)
LTRESULT CreateServerMgr()
```

### Packet Processing
```cpp
// CClientShell
LTRESULT ProcessPackets()
LTRESULT ProcessPacket(const CPacket_Read &)
void SendPacketToServer(const CPacket_Read &cPacket)
void SendCommandToServer(char *pCommand)
```

### World Management
```cpp
// CClientShell
LTRESULT DoLoadWorld(const CPacket_Read &cPacket, bool bLocal)
void NotifyWorldClosing()
void CloseWorlds()
bool CreateVisContainerObjects()
bool BindWorlds()
void UnbindWorlds()
```

### Rendering
```cpp
// CClientShell
bool Render(CameraInstance *pCamera)
void RenderCameras()
void SetCameraZOrder(CameraInstance *pCamera, int zOrder)
```

### Updates
```cpp
// CClientShell
LTRESULT Update()
void UpdateParticleSystems()
void UpdateAnimations()
```

### Bitstream Writing
```cpp
// CPacket_Write
void WriteBits(uint32 nValue, uint32 nBits)
void WriteBits64(uint64 nValue, uint32 nBits)
void WriteData(const void *pData, uint32 nBits)
void Writeuint8(uint8 nValue)
void Writeuint16(uint16 nValue)
void Writeuint32(uint32 nValue)
void Writefloat(float fValue)
void WriteLTVector(const LTVector &vValue)
void WriteString(const char *pString)
void WriteObject(HOBJECT hObj)
```

### Bitstream Reading
```cpp
// CPacket_Read
uint32 ReadBits(uint32 nBits)
uint64 ReadBits64(uint32 nBits)
void ReadData(void *pData, uint32 nBits)
uint8 Readuint8()
uint16 Readuint16()
uint32 Readuint32()
float Readfloat()
LTVector ReadLTVector()
uint32 ReadString(char *pDest, uint32 nMaxLen)
HOBJECT ReadObject()
```

### Bitstream Peeking (Non-destructive)
```cpp
// CPacket_Read
uint32 PeekBits(uint32 nBits) const
uint64 PeekBits64(uint32 nBits) const
void PeekData(void *pData, uint32 nBits) const
uint8 Peekuint8() const
uint16 Peekuint16() const
uint32 Peekuint32() const
float Peekfloat() const
LTVector PeekLTVector() const
uint32 PeekString(char *pDest, uint32 nMaxLen) const
HOBJECT PeekObject() const
```

### Position Navigation
```cpp
// CPacket_Read
void Seek(int32 nOffset)           // Relative
void SeekTo(uint32 nPos)           // Absolute
uint32 Tell() const                // Current position
uint32 TellEnd() const             // Bits remaining
bool EOP() const                   // End of packet?
```

## Naming Patterns

### Class Prefixes
- `C` = Concrete implementation (CClientShell, CPacket_Read)
- `I` = Abstract interface (IClientShell, ILTMessage_Read)
- `S` = Struct (SIterator, SChunk)

### Method Prefixes
- `On*` = Event handler (OnMessage, OnCommandOn)
- `Get*` = Accessor (GetClientID, GetPacket)
- `Set*` = Mutator (SetBandwidth, SetDisconnectCode)
- `Read*` = Data reading (ReadBits, ReadString)
- `Write*` = Data writing (WriteBits, WriteString)
- `Peek*` = Non-destructive read (PeekBits, PeekString)
- `Is*` = Boolean query (IsConnected, IsInTrouble)
- `Init/Term` = Initialization/termination

### Type Prefixes
- `LT*` = LithTech types (LTVector, LTRotation)
- `H*` = Handle types (HOBJECT, HSTRING)
- `E*` = Enum types (EDisconnectReason)

## Key Constants

```cpp
#define INVALID_CONNID NULL
#define SYNCPACKET_FREQUENCY 30
#define DRIVER_PADDING 2
#define CONNFLAG_LOCAL (1<<0)
#define NETDRIVER_TCPIP (1
