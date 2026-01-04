# ID_LOGIN_REQUEST

Initial login request sent by the client to begin the authentication process. Contains the username and client version.

## Structure

### `Packet_ID_LOGIN_REQUEST`

| Field         | Type                  | Offset | Size  |
|---------------|-----------------------|--------|-------|
| base          | `VariableSizedPacket` | 0x0    | 0x430 |
| username      | `uint8_t[64]`         | 0x430  | 0x40  |
| clientVersion | `uint16_t`            | 0x470  | 0x2   |

**Length:** 0x472

## Constructor

```c
Packet_ID_LOGIN_REQUEST *__thiscall FOM::Packets::Packet_ID_LOGIN_REQUEST::Packet_ID_LOGIN_REQUEST(Packet_ID_LOGIN_REQUEST *this)
{
  (this->base).vftable = &VariableSizedPacket::vftable;
  *(undefined1 *)&(this->base).bitStream.numberOfBitsUsed = 0;
  RakNet::BitStream::BitStream((BitStream *)&(this->base).bitStream.numberOfBitsAllocated);
  this->clientVersion = 0;
  *(undefined4 *)&(this->base).timestamp = 0;
  *(undefined4 *)((int)&(this->base).timestamp + 4) = 0;
  this->username[0] = '\0';
  (this->base).messageType = ID_LOGIN_REQUEST;
  (this->base).vftable = &vftable;
  return this;
}
```

## Read

```c
bool __thiscall FOM::Packets::Packet_ID_LOGIN_REQUEST::Read(Packet_ID_LOGIN_REQUEST *this, Packet *packet)
{
  uint32_t *this_00;
  bool bVar1;
  StringCompressor *this_01;
  uint8_t *output;
  int maxCharsToWrite;
  BitStream *input;
  int languageID;

  bVar1 = VariableSizedPacket::Read(&this->base, packet);
  if (!bVar1) {
    return false;
  }
  languageID = 0;
  this_00 = &(this->base).bitStream.numberOfBitsAllocated;
  output = this->username;
  maxCharsToWrite = 0x800;
  input = (BitStream *)this_00;
  this_01 = (StringCompressor *)RakNet::RakNet::StringCompressor::Instance();
  bVar1 = RakNet::StringCompressor::DecodeString(this_01, (char *)output, maxCharsToWrite, input, languageID);
  if (!bVar1) {
    return false;
  }
  RakNet::BitStream::ReadCompressed_T_ushort((BitStream *)this_00, &this->clientVersion);
  return true;
}
```

## Write

```c
void __thiscall FOM::Packets::Packet_ID_LOGIN_REQUEST::Write(Packet_ID_LOGIN_REQUEST *this)
{
  char extraout_AL;
  StringCompressor *this_00;
  uint8_t *input;
  int maxCharsToWrite;
  BitStream *output;
  int languageID;

  VariableSizedPacket::Write(&this->base);
  if (extraout_AL == '\0') {
    return;
  }
  languageID = 0;
  output = (BitStream *)&(this->base).bitStream.numberOfBitsAllocated;
  input = this->username;
  maxCharsToWrite = 0x800;
  this_00 = (StringCompressor *)RakNet::RakNet::StringCompressor::Instance();
  RakNet::StringCompressor::EncodeString(this_00, (char *)input, maxCharsToWrite, output, languageID);
  VariableSizedPacket::WriteCompressed_ushort(&this->base, this->clientVersion);
  return;
}
```
