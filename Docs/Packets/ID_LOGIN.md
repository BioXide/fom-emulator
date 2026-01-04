# ID_LOGIN

Sent by the client to authenticate with the game server. Contains credentials, hardware identifiers for anti-cheat purposes, and optional Steam authentication ticket.

## Structure

### `Packet_ID_LOGIN`

| Field              | Type              | Offset | Size  |
|--------------------|-------------------|--------|-------|
| base               | `VariableSizedPacket` | 0x0    | 0x430 |
| username           | `uint8_t[64]`     | 0x430  | 0x40  |
| passwordHash       | `uint8_t[64]`     | 0x470  | 0x40  |
| fileCRCs           | `vector`          | 0x4B0  | 0x10  |
| macAddress         | `uint8_t[32]`     | 0x4C0  | 0x20  |
| driveModels        | `uint8_t[4][64]`  | 0x4E0  | 0x100 |
| driveSerialNumbers | `uint8_t[4][32]`  | 0x5E0  | 0x80  |
| loginToken         | `uint8_t[64]`     | 0x660  | 0x40  |
| computerName       | `uint8_t[32]`     | 0x6A0  | 0x20  |
| hasSteamTicket     | `bool`            | 0x6C0  | 0x1   |
| steamTicketLength  | `uint32_t`        | 0x6C4  | 0x4   |
| steamTicket        | `uint8_t[1024]`   | 0x6C8  | 0x400 |

**Length:** 0xAC8

### Notes

- `fileCRCs` contains exactly 3 CRC values in order: `fom_client.exe`, `cshell.dll`, and `object.lto`
- `driveModels` and `driveSerialNumbers` are arrays of 4 strings each, used for hardware fingerprinting
- `username` and `computerName` are encoded using RakNet's `StringCompressor`
- `passwordHash` is written/read as raw bytes (not string compressed)

## Constructor

```c
Packet_ID_LOGIN *__thiscall FOM::Packets::Packet_ID_LOGIN::Packet_ID_LOGIN(Packet_ID_LOGIN *this)
{
  uint8_t (*pauVar1)[32];
  uint8_t (*pauVar2)[64];
  int iVar3;
  void *local_10;
  undefined1 *puStack_c;
  undefined4 local_8;

  local_8 = 0xffffffff;
  puStack_c = &LAB_0067a668;
  local_10 = ExceptionList;
  ExceptionList = &local_10;
  (this->base).vftable = &VariableSizedPacket::vftable;
  *(undefined1 *)&(this->base).bitStream.numberOfBitsUsed = 0;
  RakNet::BitStream::BitStream((BitStream *)&(this->base).bitStream.numberOfBitsAllocated);
  *(undefined4 *)&(this->base).timestamp = 0;
  *(undefined4 *)((int)&(this->base).timestamp + 4) = 0;
  (this->base).messageType = ID_LOGIN;
  local_8 = 0;
  (this->base).vftable = &vftable;
  FUN_00564a40(&this->fileCRCs);
  this->username[0] = '\0';
  this->passwordHash[0] = '\0';
  this->macAddress[0] = '\0';
  pauVar1 = this->driveSerialNumbers;
  pauVar2 = this->driveModels;
  iVar3 = 4;
  do {
    (*pauVar2)[0] = '\0';
    (*pauVar1)[0] = '\0';
    pauVar1 = pauVar1 + 1;
    pauVar2 = pauVar2 + 1;
    iVar3 = iVar3 + -1;
  } while (iVar3 != 0);
  this->loginToken[0] = '\0';
  this->computerName[0] = '\0';
  this->hasSteamTicket = false;
  this->steamTicketLength = 0;
  memset(this->steamTicket, 0, 0x400);
  ExceptionList = local_10;
  return this;
}
```

## Read

```c
bool __thiscall FOM::Packets::Packet_ID_LOGIN::Read(Packet_ID_LOGIN *this, Packet *packet)
{
  uint32_t *this_00;
  bool bVar1;
  StringCompressor *pSVar2;
  uint8_t (*pauVar3)[64];
  uint8_t (*pauVar4)[32];
  uint uVar5;
  uint8_t *puVar6;
  int iVar7;
  BitStream *pBVar8;
  BitStream *input;
  int iVar9;

  bVar1 = VariableSizedPacket::Read(&this->base, packet);
  if (!bVar1) {
    return false;
  }
  iVar9 = 0;
  pBVar8 = (BitStream *)&(this->base).bitStream.numberOfBitsAllocated;
  puVar6 = this->username;
  iVar7 = 0x800;
  input = pBVar8;
  pSVar2 = (StringCompressor *)RakNet::RakNet::StringCompressor::Instance();
  bVar1 = RakNet::StringCompressor::DecodeString(pSVar2, (char *)puVar6, iVar7, input, iVar9);
  if (bVar1) {
    VariableSizedPacket::ReadString(this, this->passwordHash, 0x40);
    FUN_005649d0(&this->fileCRCs, pBVar8);
    iVar9 = 0;
    puVar6 = this->macAddress;
    iVar7 = 0x800;
    pSVar2 = (StringCompressor *)RakNet::RakNet::StringCompressor::Instance();
    bVar1 = RakNet::StringCompressor::DecodeString(pSVar2, (char *)puVar6, iVar7, pBVar8, iVar9);
    if (bVar1) {
      pauVar4 = this->driveSerialNumbers;
      pauVar3 = this->driveModels;
      packet = (Packet *)0x4;
      do {
        VariableSizedPacket::ReadString(this, pauVar3, 0x40);
        VariableSizedPacket::ReadString(this, pauVar4, 0x20);
        pauVar4 = pauVar4 + 1;
        pauVar3 = pauVar3 + 1;
        packet = (Packet *)&packet[-1].field_0x33;
      } while (packet != (Packet *)0x0);
      VariableSizedPacket::ReadString(this, this->loginToken, 0x40);
      iVar9 = 0;
      this_00 = &(this->base).bitStream.numberOfBitsAllocated;
      puVar6 = this->computerName;
      iVar7 = 0x800;
      pBVar8 = (BitStream *)this_00;
      pSVar2 = (StringCompressor *)RakNet::RakNet::StringCompressor::Instance();
      bVar1 = RakNet::StringCompressor::DecodeString(pSVar2, (char *)puVar6, iVar7, pBVar8, iVar9);
      if (!bVar1) {
        return false;
      }
      VariableSizedPacket::ReadBit(&this->base, &this->hasSteamTicket);
      if (this->hasSteamTicket != false) {
        uVar5 = 0;
        do {
          RakNet::BitStream::ReadCompressed((BitStream *)this_00, this->steamTicket + uVar5, 8, true);
          uVar5 = uVar5 + 1;
        } while (uVar5 < 0x400);
        RakNet::BitStream::ReadCompressed_T_uint((BitStream *)this_00, &this->steamTicketLength);
      }
      return true;
    }
  }
  return false;
}
```

## Write

```c
void __thiscall FOM::Packets::Packet_ID_LOGIN::Write(Packet_ID_LOGIN *this)
{
  uint32_t *this_00;
  char extraout_AL;
  bool bVar1;
  StringCompressor *pSVar2;
  uint8_t (*pauVar3)[32];
  uint uVar4;
  uint8_t *puVar5;
  int iVar6;
  BitStream *pBVar7;
  int iVar8;
  uint32_t local_10;
  uint8_t (*local_c)[64];
  uint8_t local_8[4];

  VariableSizedPacket::Write(&this->base);
  if (extraout_AL == '\0') {
    return;
  }
  iVar8 = 0;
  this_00 = &(this->base).bitStream.numberOfBitsAllocated;
  puVar5 = this->username;
  iVar6 = 0x800;
  pBVar7 = (BitStream *)this_00;
  pSVar2 = (StringCompressor *)RakNet::RakNet::StringCompressor::Instance();
  RakNet::StringCompressor::EncodeString(pSVar2, (char *)puVar5, iVar6, pBVar7, iVar8);
  VariableSizedPacket::WriteString(this, this->passwordHash, 0x40);
  FUN_00564950(&this->fileCRCs, this_00);
  iVar8 = 0;
  puVar5 = this->macAddress;
  iVar6 = 0x800;
  pBVar7 = (BitStream *)this_00;
  pSVar2 = (StringCompressor *)RakNet::RakNet::StringCompressor::Instance();
  RakNet::StringCompressor::EncodeString(pSVar2, (char *)puVar5, iVar6, pBVar7, iVar8);
  local_c = this->driveModels;
  pauVar3 = this->driveSerialNumbers;
  local_10 = 4;
  do {
    VariableSizedPacket::WriteString(this, *local_c, 0x40);
    VariableSizedPacket::WriteString(this, *pauVar3, 0x20);
    local_c = local_c + 1;
    pauVar3 = pauVar3 + 1;
    local_10 = local_10 - 1;
  } while (local_10 != 0);
  VariableSizedPacket::WriteString(this, this->loginToken, 0x40);
  iVar8 = 0;
  puVar5 = this->computerName;
  iVar6 = 0x800;
  pBVar7 = (BitStream *)this_00;
  pSVar2 = (StringCompressor *)RakNet::RakNet::StringCompressor::Instance();
  RakNet::StringCompressor::EncodeString(pSVar2, (char *)puVar5, iVar6, pBVar7, iVar8);
  if (this->hasSteamTicket == false) {
    RakNet::BitStream::Write0((BitStream *)this_00);
  }
  else {
    RakNet::BitStream::Write1((BitStream *)this_00);
  }
  if (this->hasSteamTicket != false) {
    uVar4 = 0;
    do {
      local_8[0] = this->steamTicket[uVar4];
      RakNet::BitStream::WriteCompressed((BitStream *)this_00, local_8, 8, true);
      uVar4 = uVar4 + 1;
    } while (uVar4 < 0x400);
    local_10 = this->steamTicketLength;
    bVar1 = RakNet::BitStream::DoEndianSwap();
    if (bVar1) {
      RakNet::BitStream::ReverseBytes((uchar *)&local_10, (uchar *)&local_c, 4);
      RakNet::BitStream::WriteCompressed((BitStream *)this_00, (uchar *)&local_c, 0x20, true);
      return;
    }
    RakNet::BitStream::WriteCompressed((BitStream *)this_00, (uchar *)&local_10, 0x20, true);
  }
  return;
}
```
