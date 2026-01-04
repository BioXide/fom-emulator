# Login Packet Reconciliation Plan (RakNet 3.611 + Docs/Packets)

Date: 2026-01-03
Owner: PITI
Last updated: 2026-01-03 17:08 local

## Truth Sources (non-negotiable)
- External RakNet: External/raknet (version 3.611, protocol 6)
- Packet truth (open these first if unsure):
  - Docs/Packets/ID_LOGIN_REQUEST.md
  - Docs/Packets/ID_LOGIN_REQUEST_RETURN.md
  - Docs/Packets/ID_LOGIN.md
  - Docs/Packets/ID_LOGIN_RETURN.md
  - Docs/Packets/ID_LOGIN_TOKEN_CHECK.md

## Problem Statement
Current client/server implementations and several docs follow the wrong login sequence and wrong wire formats. This blocks correct parsing of login packets (notably the message currently observed as 0x6D) and makes the emulator incompatible with the real client. We must realign everything to RakNet 3.611 + Docs/Packets.

## Goals
- Align server emulator, client emulator, and docs with RakNet 3.611 and Docs/Packets.
- Correct packet IDs, field order, compression methods, and sequence flow.
- Update AddressMap and IDA DB symbol names to match truth.
- Make 0x6D parse correctly by using the real packet definition and proper StringCompressor/Huffman + BitStream semantics.

## Non-Goals
- Implement full gameplay or world protocol beyond login flow.
- Reverse new packets outside the login sequence.

## Deliverables
1) ServerEmulator: correct login flow parsing and responses.
2) ClientEmulator: correct login sequence and parsing.
3) Documentation: updated login flow, packet docs, AddressMap deltas.
4) IDA DBs: renamed packet classes, constructors, Read/Write, handlers.
5) Tests: encode/decode fixtures for login packets matching Docs/Packets.

## Canonical Login Flow (Docs/Packets)
1) Client -> Server: ID_LOGIN_REQUEST
2) Server -> Client: ID_LOGIN_REQUEST_RETURN
3) Client -> Server: ID_LOGIN
4) Server -> Client: ID_LOGIN_RETURN
5) Optional: ID_LOGIN_TOKEN_CHECK (bidirectional) if token flow is active

Do not assume numeric IDs (0x6C/0x6D/etc). Extract numeric values from constructors in IDA and map to MessageIdentifiers.h (ID_USER_PACKET_ENUM base = 104 / 0x68 for RakNet 3.611) before hard-coding any constants.

## RakNet 3.611 Invariants (must match)
- Protocol version: 6 (RakNetVersion.h)
- ID_USER_PACKET_ENUM base: 104 (0x68) (MessageIdentifiers.h)
- BitStream is MSB-first and bit-aligned.
- WriteCompressed/ReadCompressed operate on bit lengths, not byte lengths, and are endian-aware.
- StringCompressor uses Huffman (EncodeString/DecodeString). LanguageID = 0 in FoM packet code.
- Reliability layer headers are bit-aligned; messageNumber is 32-bit.
- WriteAlignedBytes aligns to a byte boundary before copying raw bytes.

## Packet Truth Extract (cheat sheet)
These are the packet-level facts to implement exactly.

### ID_LOGIN_REQUEST
- Field order: username (StringCompressor, maxChars 0x800), clientVersion (compressed uint16)
- username buffer size: 64
- Length: 0x472, base offset: 0x430

### ID_LOGIN_REQUEST_RETURN
- Field order: status (compressed byte), username (StringCompressor, maxChars 0x800)
- status enum:
  - INVALID_INFO = 0
  - SUCCESS = 1
  - OUTDATED_CLIENT = 2
  - ALREADY_LOGGED_IN = 3
- username buffer size: 64
- Length: 0x471, base offset: 0x430

### ID_LOGIN
- Field order:
  1) username (StringCompressor)
  2) passwordHash (raw 64 bytes via VariableSizedPacket::ReadString/WriteString)
  3) fileCRCs (vector of exactly 3 values: fom_client.exe, cshell.dll, object.lto)
  4) macAddress (StringCompressor)
  5) driveModels[4] (raw string[64] each)
  6) driveSerialNumbers[4] (raw string[32] each)
  7) loginToken (raw string[64])
  8) computerName (StringCompressor)
  9) hasSteamTicket (bit)
  10) if hasSteamTicket: steamTicket[0x400] as compressed bytes, then steamTicketLength (compressed uint32)
- Length: 0xAC8, base offset: 0x430
- Notes: passwordHash is NOT StringCompressor; loginToken is raw fixed-size string; hasSteamTicket uses BitStream bit write.

### ID_LOGIN_RETURN
- Field order (compressed unless noted):
  - status (compressed byte)
  - playerID (compressed uint32)
  - if playerID != 0:
    - accountType (compressed byte)
    - field4_0x439 (bit)
    - field5_0x43a (bit)
    - clientVersion (compressed uint16)
    - isBanned (bit)
    - if isBanned: banLength (EncodeString), banReason (DecodeString)
    - worldIDs vector (count compressed byte + ids compressed uint32)
    - factionMOTD string (Encode/DecodeString)
    - Apartment (FUN_10055080 order; see Docs/Packets/ID_LOGIN_RETURN.md)
    - field_final1 (compressed byte)
    - field_final2 (compressed byte)
- Base length: 0x4D0, extended data stored beyond base via this[1]/this[2]
- See Docs/Packets/ID_LOGIN_RETURN.md for full wire order and Apartment/Item structures.

### ID_LOGIN_TOKEN_CHECK
- Field order:
  - fromServer (bit)
  - if fromServer == true: success (bit) + username (raw string[32])
  - else: requestToken (raw string[32])
- Length: 0x472

## Known Incorrect Assumptions To Purge
These exist in current code/docs; remove or rewrite them.
- Login flow based on 0x6C/0x6D/0x6E with a session string instead of the real ID_LOGIN_REQUEST / ID_LOGIN_REQUEST_RETURN / ID_LOGIN / ID_LOGIN_RETURN sequence.
- Treating 0x6D as raw session text (should be status + StringCompressor username when it maps to ID_LOGIN_REQUEST_RETURN).
- Decoding strings as plain bytes or null-terminated without StringCompressor/Huffman.
- Assuming LSB bit order in BitStream.
- Legacy byte-aligned "17-byte header" reliability wrapper.
- Missing ID_LOGIN_RETURN and ID_LOGIN_TOKEN_CHECK handling.
- ID_LOGIN field order and compression mismatches (passwordHash, loginToken, fileCRCs, drive info, Steam ticket).
- Assuming numeric message IDs without validating from IDA constructors.

## Workstreams

### A) Ground Truth Mapping (IDA + RakNet)
- Extract numeric IDs from constructors in IDA for:
  - Packet_ID_LOGIN_REQUEST
  - Packet_ID_LOGIN_REQUEST_RETURN
  - Packet_ID_LOGIN
  - Packet_ID_LOGIN_RETURN
  - Packet_ID_LOGIN_TOKEN_CHECK
- Confirm RakNet 3.611 BitStream invariants in code (MSB-first, WriteCompressed behavior).
- Confirm ReliabilityLayer header format in 3.611 (bit-aligned, 32-bit messageNumber) and map to FoM usage.
- Map IDs to MessageIdentifiers.h base (ID_USER_PACKET_ENUM = 104 / 0x68) and update constants in emulator.

### B) ServerEmulator Fixes
- Replace login parser to accept ID_LOGIN_REQUEST (StringCompressor username + compressed clientVersion).
- Build ID_LOGIN_REQUEST_RETURN as: status (compressed byte) + username (StringCompressor).
- Replace ID_LOGIN parsing with the real structure from Docs/Packets/ID_LOGIN.md (order + compression).
- Implement ID_LOGIN_RETURN response (minimal success path first, then full payload once stable).
- Implement ID_LOGIN_TOKEN_CHECK (fromServer switch) if observed from client.
- Update reliable parse/wrap to RakNet 3.611 bit-aligned format; remove legacy wrapper assumptions.
- Update tests to match new payloads (rename and rework any login6d tests).

### C) ClientEmulator Fixes
- Emit ID_LOGIN_REQUEST using StringCompressor + compressed clientVersion.
- Parse ID_LOGIN_REQUEST_RETURN (status + echoed username).
- Emit ID_LOGIN using correct full structure and compression.
- Parse ID_LOGIN_RETURN and advance login state accordingly.
- Handle ID_LOGIN_TOKEN_CHECK if required by server flow.

### D) Documentation and AddressMap
- Replace login flow descriptions in:
  - Docs/Notes/Login_Flow.md
  - Docs/Notes/LOGIN.md
  - Docs/Notes/LOGIN_REQUEST_RETURN.md
  - Docs/Notes/LoginFlow_Client.md
  - Docs/Notes/ClientNetworking.md
- Add explicit cross-links: Docs\Packets are canonical.
- Update AddressMap entries for login packet handlers, constructors, and read/write functions.
- Record removed assumptions (session string path, legacy flow, any invented fields).

### E) IDA DB Renaming (fom_client.exe + cshell.dll)
- Rename packet classes/vtables/read/write methods to match Docs/Packets.
- Rename helpers:
  - fileCRCs read/write vector
  - Apartment and ItemList read/write functions
  - String encode/decode wrappers (LTNetwork)
- Update enums for LoginRequestReturnStatus, LoginReturnStatus, AccountType, ItemType, ItemQuality.
- Add comments for each Read/Write function to reflect true field order and compression.
- Record addresses in AddressMap.md as soon as confirmed.

## Validation Plan
- Unit tests: encode/decode roundtrip for each login packet using RakNet BitStream rules.
- Integration: client emulator connects to server emulator, completes login sequence without special cases.
- Hook logging: verify ID_LOGIN_REQUEST_RETURN parsed and acked correctly, ID_LOGIN_RETURN consumed.

## Risks and Mitigations
- Risk: bit-aligned vs byte-aligned confusion. Fix by aligning BitStream usage to RakNet 3.611 and validating against real captures.
- Risk: ID mapping drift. Fix by extracting messageType assignments directly from IDA constructors.
- Risk: string compression mismatch. Fix by using StringCompressor/Huffman everywhere Docs/Packets uses it.

## Rollback Strategy
- Code: git revert or stash per commit.
- Docs: keep a copy under %USERPROFILE%\.codex\backups\ with timestamp.
- Before behavioral changes: log intended delta, diff reference, and rollback command in Docs/Logs/Emulator.md.

## Order of Execution (short version)
1) ID mapping in IDA + update constants.
2) ServerEmulator parser/encoder changes + tests.
3) ClientEmulator changes + tests.
4) Docs/AddressMap updates.
5) Final integration pass + logs.
