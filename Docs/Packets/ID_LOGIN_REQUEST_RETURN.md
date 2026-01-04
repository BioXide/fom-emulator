# ID_LOGIN_REQUEST_RETURN

Server response to `ID_LOGIN_REQUEST`. Contains the status of the login request and echoes back the username.

## Structure

### `Packet_ID_LOGIN_REQUEST_RETURN`

| Field    | Type                       | Offset | Size  |
|----------|----------------------------|--------|-------|
| base     | `VariableSizedPacket`      | 0x0    | 0x430 |
| status   | `LoginRequestReturnStatus` | 0x430  | 0x1   |
| username | `uint8_t[64]`              | 0x431  | 0x40  |

**Length:** 0x471

### `LoginRequestReturnStatus`

A `uint8_t` enum indicating the result of the login request.

| Name                                   | Value |
|----------------------------------------|-------|
| LOGIN_REQUEST_RETURN_INVALID_INFO      | 0     |
| LOGIN_REQUEST_RETURN_SUCCESS           | 1     |
| LOGIN_REQUEST_RETURN_OUTDATED_CLIENT   | 2     |
| LOGIN_REQUEST_RETURN_ALREADY_LOGGED_IN | 3     |

## Constructor

```c
Packet_ID_LOGIN_REQUEST_RETURN *__thiscall FOM::Packets::Packet_ID_LOGIN_REQUEST_RETURN::Packet_ID_LOGIN_REQUEST_RETURN(Packet_ID_LOGIN_REQUEST_RETURN *this)
{
  (this->base).vftable = &VariableSizedPacket::vftable;
  *(undefined1 *)&(this->base).bitStream.numberOfBitsUsed = 0;
  RakNet::BitStream::BitStream((BitStream *)&(this->base).bitStream.numberOfBitsAllocated);
  *(undefined4 *)&(this->base).timestamp = 0;
  *(undefined4 *)((int)&(this->base).timestamp + 4) = 0;
  this->status = INVALID_INFO;
  this->username[0] = '\0';
  (this->base).messageType = ID_LOGIN_REQUEST_RETURN;
  (this->base).vftable = &vftable;
  return this;
}
```

## Read

```c
bool __thiscall FOM::Packets::Packet_ID_LOGIN_REQUEST_RETURN::Read(Packet_ID_LOGIN_REQUEST_RETURN *this, Packet *packet)
{
  bool bVar1;
  StringCompressor *this_00;
  uint8_t *output;
  int maxCharsToWrite;
  BitStream *this_01;
  int languageID;

  bVar1 = VariableSizedPacket::Read(&this->base, packet);
  if (!bVar1) {
    return false;
  }
  this_01 = (BitStream *)&(this->base).bitStream.numberOfBitsAllocated;
  RakNet::BitStream::ReadCompressed(this_01, &this->status, 8, true);
  languageID = 0;
  maxCharsToWrite = 0x800;
  output = this->username;
  this_00 = (StringCompressor *)RakNet::RakNet::StringCompressor::Instance();
  bVar1 = RakNet::StringCompressor::DecodeString(this_00, (char *)output, maxCharsToWrite, this_01, languageID);
  return bVar1;
}
```

## Write

```c
void __thiscall FOM::Packets::Packet_ID_LOGIN_REQUEST_RETURN::Write(Packet_ID_LOGIN_REQUEST_RETURN *this)
{
  char extraout_AL;
  StringCompressor *this_00;
  uint8_t *input;
  int maxCharsToWrite;
  BitStream *this_01;
  int languageID;
  Packet_ID_LOGIN_REQUEST_RETURN *local_8;

  local_8 = this;
  VariableSizedPacket::Write(&this->base);
  if (extraout_AL == '\0') {
    return;
  }
  this_01 = (BitStream *)&(this->base).bitStream.numberOfBitsAllocated;
  local_8 = (Packet_ID_LOGIN_REQUEST_RETURN *)CONCAT31(local_8._1_3_, this->status);
  RakNet::BitStream::WriteCompressed(this_01, (uchar *)&local_8, 8, true);
  languageID = 0;
  maxCharsToWrite = 0x800;
  input = this->username;
  this_00 = (StringCompressor *)RakNet::RakNet::StringCompressor::Instance();
  RakNet::StringCompressor::EncodeString(this_00, (char *)input, maxCharsToWrite, this_01, languageID);
  return;
}
```
