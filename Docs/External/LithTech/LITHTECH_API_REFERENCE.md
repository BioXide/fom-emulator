# LithTech API Reference - Extracted from External/LithTech Source

## Class Hierarchy & Inheritance

### Network Handler Base Classes
- **CNetHandler** (base class for network message handlers)
  - Inheritance: Pure virtual interface
  - Key methods:
    - `virtual bool NewConnectionNotify(CBaseConn *id, bool bIsLocal)`
    - `virtual void DisconnectNotify(CBaseConn *id, EDisconnectReason eDisconnectReason)`
    - `virtual void HandleUnknownPacket(const CPacket_Read &cPacket, uint8 senderAddr[4], uint16 senderPort)`
    - `virtual void SetDisconnectCode(uint32 nCode, const char *pMsg)`

- **CClientShell** : public CNetHandler
  - Location: `External/LithTech/engine/runtime/client/src/clientshell.h`
  - Key methods:
    - `CClientShell()` / `~CClientShell()`
    - `bool Init()`
    - `void Term()`
    - `LTRESULT StartupClient(CBaseDriver *pDriver)`
    - `LTRESULT StartupLocal(StartGameRequest *pRequest, bool bHost, CBaseDriver *pServerDriver)`
    - `LTRESULT CreateServerMgr()`
    - `bool Render(CameraInstance *pCamera)`
    - `LTRESULT Update()`
    - `void RenderCameras()`
    - `void SetCameraZOrder(CameraInstance *pCamera, int zOrder)`
    - `void SendCommandToServer(char *pCommand)`
    - `void SendPacketToServer(const CPacket_Read &cPacket)`
    - `void RemoveAllObjects()`
    - `LTRESULT DoLoadWorld(const CPacket_Read &cPacket, bool bLocal)`
    - `void NotifyWorldClosing()`
    - `void CloseWorlds()`
    - `bool CreateVisContainerObjects()`
    - `bool BindWorlds()`
    - `void UnbindWorlds()`
    - `void InitHandlers()`
    - `LTRESULT ProcessPackets()`
    - `LTRESULT ProcessPacket(const CPacket_Read &)`
    - `void SendGoodbye(void)`
    - `void UpdateParticleSystems()`
    - `void UpdateAnimations()`
    - `void SetCommandState(uint16 command, uint8 state)`
    - `uint8 GetCommandState(uint16 command)`
    - `LTObject* GetClientObject()`
    - `uint16 GetClientID()`
    - `FileIDInfo* GetClientFileIDInfo(uint16 wFileID)`

### Message Interface Classes

#### ILTMessage_Write (Abstract Interface)
- Location: `External/LithTech/engine/sdk/inc/iltmessage.h`
- Base: `ILTRefCount`
- Key virtual methods:
  - `void Reset()`
  - `ILTMessage_Read *Read()`
  - `uint32 Size() const`
  - `void WriteBits(uint32 nValue, uint32 nSize)`
  - `void WriteBits64(uint64 nValue, uint32 nSize)`
  - `void WriteData(const void *pData, uint32 nSize)`
  - `void WriteMessage(const ILTMessage_Read *pMsg)`
  - `void WriteMessageRaw(const ILTMessage_Read *pMsg)`
  - `void WriteString(const char *pString)`
  - `void WriteHString(HSTRING hString)`
  - `void WriteCompLTVector(const LTVector &vVec)`
  - `void WriteCompPos(const LTVector &vPos)`
  - `void WriteCompLTRotation(const LTRotation &cRotation)`
  - `void WriteHStringFormatted(int nStringCode, ...)`
  - `void WriteHStringArgList(int nStringCode, va_list *pList)`
  - `void WriteStringAsHString(const char *pString)`
  - `void WriteObject(HOBJECT hObj)`
  - `void WriteYRotation(const LTRotation &cRotation)`

#### ILTMessage_Read (Abstract Interface)
- Location: `External/LithTech/engine/sdk/inc/iltmessage.h`
- Base: `ILTRefCount`
- Key virtual methods:
  - `ILTMessage_Read *Clone() const`
  - `ILTMessage_Read *SubMsg(uint32 nPos) const`
  - `ILTMessage_Read *SubMsg(uint32 nPos, uint32 nLength) const`
  - `uint32 Size() const`
  - `void Seek(int32 nOffset)`
  - `void SeekTo(uint32 nPos)`
  - `uint32 Tell() const`
  - `uint32 TellEnd() const`
  - `bool EOM() const`
  - `uint32 ReadBits(uint32 nBits)`
  - `uint64 ReadBits64(uint32 nBits)`
  - `void ReadData(void *pData, uint32 nBits)`
  - `ILTMessage_Read *ReadMessage()`
  - `uint32 ReadString(char *pDest, uint32 nMaxLen)`
  - `HSTRING ReadHString()`
  - `LTVector ReadCompLTVector()`
  - `LTVector ReadCompPos()`
  - `LTRotation ReadCompLTRotation()`
  - `uint32 ReadHStringAsString(char *pDest, uint32 nMaxLen)`
  - `HOBJECT ReadObject()`
  - `LTRotation ReadYRotation()`

#### CLTMessage_Write (Base Implementation)
- Location: `External/LithTech/engine/runtime/shared/src/ltmessage.h`
- Base: `ILTMessage_Write`
- Key methods:
  - `CPacket_Write &GetPacket()`
  - `const CPacket_Write &GetPacket() const`
  - Static: `WriteCompLTVector(CPacket_Write &cPacket, const LTVector &vVec)`
  - Static: `WriteCompLTRotation(CPacket_Write &cPacket, const LTRotation &cRotation)`
  - Static: `WriteObject(CPacket_Write &cPacket, HOBJECT hObj)`
  - Static: `WriteYRotation(CPacket_Write &cPacket, const LTRotation &cRotation)`

#### CLTMessage_Read (Base Implementation)
- Location: `External/LithTech/engine/runtime/shared/src/ltmessage.h`
- Base: `ILTMessage_Read`
- Key methods:
  - `CPacket_Read &GetPacket()`
  - `const CPacket_Read &GetPacket() const`
  - Static: `ReadCompLTVector(CPacket_Read &cPacket)`
  - Static: `ReadCompLTRotation(CPacket_Read &cPacket)`
  - Static: `ReadYRotation(CPacket_Read &cPacket)`
  - Static: `PeekCompLTVector(const CPacket_Read &cPacket)`
  - Static: `PeekCompLTRotation(const CPacket_Read &cPacket)`
  - Static: `PeekYRotation(const CPacket_Read &cPacket)`

#### CLTMessage_Read_Client
- Location: `External/LithTech/engine/runtime/client/src/ltmessage_client.h`
- Base: `CLTMessage_Read`
- Key methods:
  - `virtual void Free()`
  - `virtual LTVector ReadCompPos()`
  - `virtual HOBJECT ReadObject()`
  - `virtual LTVector PeekCompPos() const`
  - `virtual HOBJECT PeekObject() const`
  - Static: `Allocate_Client(const CPacket_Read &cPacket)`
  - Static: `ReadCompPos(CPacket_Read &cPacket)`
  - Static: `ReadObject(CPacket_Read &cPacket)`
  - Static: `PeekCompPos(const CPacket_Read &cPacket)`
  - Static: `PeekObject(const CPacket_Read &cPacket)`

#### CLTMessage_Write_Client
- Location: `External/LithTech/engine/runtime/client/src/ltmessage_client.h`
- Base: `CLTMessage_Write`
- Key methods:
  - `virtual void Free()`
  - `virtual ILTMessage_Read *Read()`
  - `virtual void WriteCompPos(const LTVector &vPos)`
  - Static: `Allocate_Client()`
  - Static: `WriteCompPos(CPacket_Write &cPacket, const LTVector &vPos)`

### Packet Classes

#### CPacket_Data (Internal Data Container)
- Location: `External/LithTech/engine/runtime/kernel/net/src/packet.h`
- Key methods:
  - `static CPacket_Data *Allocate()`
  - `void IncRef() const`
  - `void DecRef() const`
  - `uint32 GetRefCount() const`
  - `bool Append(uint32 nData, uint32 nBits)`
  - `bool CreateWriteRaw(uint8 *pData, uint32 nBytes)`
  - `TIterator Begin()`
  - `TIterator End()`
  - `TConstIterator Begin() const`
  - `TConstIterator End() const`
  - `uint32 Size() const`
  - `bool Empty() const`
  - `uint32 GetByteCapacity() const`
  - `void Free()`

#### CPacket_Write (Bitstream Writer)
- Location: `External/LithTech/engine/runtime/kernel/net/src/packet.h`
- Key methods:
  - `CPacket_Write()`
  - `~CPacket_Write()`
  - `void Reset()`
  - `uint32 Size() const`
  - `bool Empty() const`
  - `void WriteBits(uint32 nValue, uint32 nBits)`
  - `void WriteBits64(uint64 nValue, uint32 nBits)`
  - `void WriteData(const void *pData, uint32 nBits)`
  - `void WriteDataRaw(void *pData, uint32 nBytes)`
  - `void WritePacket(const CPacket_Read &cRead)`
  - `void Writebool(bool bValue)`
  - `void Writeuint8(uint8 nValue)`
  - `void Writeuint16(uint16 nValue)`
  - `void Writeuint32(uint32 nValue)`
  - `void Writeuint64(uint64 nValue)`
  - `void Writeint8(int8 nValue)`
  - `void Writeint16(int16 nValue)`
  - `void Writeint32(int32 nValue)`
  - `void Writeint64(uint64 nValue)`
  - `void Writefloat(float fValue)`
  - `void Writedouble(double fValue)`
  - `void WriteLTVector(const LTVector &vValue)`
  - `void WriteString(const char *pString)`
  - Template: `WriteType(const T &tValue)`

#### CPacket_Read (Bitstream Reader)
- Location: `External/LithTech/engine/runtime/kernel/net/src/packet.h`
- Key methods:
  - `CPacket_Read()`
  - `CPacket_Read(CPacket_Write &cOther)`
  - `CPacket_Read(const CPacket_Read &cOther, uint32 nStart = 0)`
  - `CPacket_Read(const CPacket_Read &cOther, uint32 nStart, uint32 nSize)`
  - `~CPacket_Read()`
  - `CPacket_Read &operator=(const CPacket_Read &cOther)`
  - `void Clear()`
  - `uint32 Size() const`
  - `bool Empty() const`
  - `void Seek(in
