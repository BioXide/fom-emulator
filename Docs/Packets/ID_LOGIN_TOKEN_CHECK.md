# ID_LOGIN_TOKEN_CHECK

Bidirectional packet used for token-based authentication. The `fromServer` flag determines the direction and which fields are used.

## Structure

### `Packet_ID_LOGIN_TOKEN_CHECK`

| Field        | Type                  | Offset | Size  |
|--------------|-----------------------|--------|-------|
| base         | `VariableSizedPacket` | 0x0    | 0x430 |
| fromServer   | `bool`                | 0x430  | 0x1   |
| success      | `bool`                | 0x431  | 0x1   |
| requestToken | `uint8_t[32]`         | 0x432  | 0x20  |
| username     | `uint8_t[32]`         | 0x452  | 0x20  |

**Length:** 0x472

### Notes

- When `fromServer` is `false` (client to server): `requestToken` is sent
- When `fromServer` is `true` (server to client): `success` and `username` are sent

## Constructor

```c
Packet_ID_LOGIN_TOKEN_CHECK *__thiscall FOM::Packets::Packet_ID_LOGIN_TOKEN_CHECK::Packet_ID_LOGIN_TOKEN_CHECK(Packet_ID_LOGIN_TOKEN_CHECK *this)
{
  (this->base).vftable = &VariableSizedPacket::vftable;
  *(undefined1 *)&(this->base).bitStream.numberOfBitsUsed = 0;
  RakNet::BitStream::BitStream((BitStream *)&(this->base).bitStream.numberOfBitsAllocated);
  *(undefined4 *)&(this->base).timestamp = 0;
  *(undefined4 *)((int)&(this->base).timestamp + 4) = 0;
  this->fromServer = false;
  this->success = false;
  this->requestToken[0] = '\0';
  this->username[0] = '\0';
  (this->base).messageType = ID_LOGIN_TOKEN_CHECK;
  (this->base).vftable = (VariableSizedPacket_vftbl *)vftable;
  return this;
}
```

## Read

```c
bool __thiscall FOM::Packets::Packet_ID_LOGIN_TOKEN_CHECK::Read(Packet_ID_LOGIN_TOKEN_CHECK *this)
{
  uint8_t **ppuVar1;
  uint8_t *puVar2;
  bool bVar3;
  Packet *in_stack_00000004;

  bVar3 = VariableSizedPacket::Read(&this->base, in_stack_00000004);
  if (!bVar3) {
    return false;
  }
  puVar2 = (this->base).bitStream.data;
  if (puVar2 + 1 <= (uint8_t *)(this->base).bitStream.numberOfBitsAllocated) {
    this->fromServer =
         (*(byte *)(((uint)puVar2 >> 3) + *(int *)&(this->base).bitStream.copyData) &
         (byte)(0x80 >> ((byte)puVar2 & 7))) != 0;
    ppuVar1 = &(this->base).bitStream.data;
    *ppuVar1 = *ppuVar1 + 1;
  }
  if (this->fromServer != false) {
    VariableSizedPacket::ReadBit(&this->base, &this->success);
    VariableSizedPacket::ReadString(this, this->username, 0x20);
    return true;
  }
  VariableSizedPacket::ReadString(this, this->requestToken, 0x20);
  return true;
}
```

## Write

```c
void __thiscall FOM::Packets::Packet_ID_LOGIN_TOKEN_CHECK::Write(Packet_ID_LOGIN_TOKEN_CHECK *this)
{
  uint32_t *this_00;
  char extraout_AL;

  VariableSizedPacket::Write(&this->base);
  if (extraout_AL == '\0') {
    return;
  }
  this_00 = &(this->base).bitStream.numberOfBitsAllocated;
  if (this->fromServer == false) {
    RakNet::BitStream::Write0((BitStream *)this_00);
  }
  else {
    RakNet::BitStream::Write1((BitStream *)this_00);
  }
  if (this->fromServer != false) {
    if (this->success != false) {
      RakNet::BitStream::Write1((BitStream *)this_00);
      VariableSizedPacket::WriteString(this, this->username, 0x20);
      return;
    }
    RakNet::BitStream::Write0((BitStream *)this_00);
    VariableSizedPacket::WriteString(this, this->username, 0x20);
    return;
  }
  VariableSizedPacket::WriteString(this, this->requestToken, 0x20);
  return;
}
```
