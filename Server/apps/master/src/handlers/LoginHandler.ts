/**
 * Login Handler for V2
 *
 * Handles the FoM login flow based on Docs/Packets specifications:
 *   0x6C (LOGIN_REQUEST) -> 0x6D (LOGIN_REQUEST_RETURN)
 *   0x6E (LOGIN) -> 0x6F (LOGIN_RETURN)
 *   0x70 (LOGIN_TOKEN_CHECK) bidirectional
 *   0x72 (WORLD_LOGIN) -> 0x73 (WORLD_LOGIN_RETURN)
 *   0x7B (WORLD_SELECT)
 *
 * Packet formats are based on reverse-engineered structures from:
 * - Docs/Packets/ID_LOGIN_REQUEST.md
 * - Docs/Packets/ID_LOGIN_REQUEST_RETURN.md
 * - Docs/Packets/ID_LOGIN.md
 * - Docs/Packets/ID_LOGIN_RETURN.md
 * - Docs/Packets/ID_LOGIN_TOKEN_CHECK.md
 */

import {
    RakNetMessageId,
    RakMessageId,
    LoginRequestReturnStatus,
    LoginReturnStatus,
    AccountType,
    type RakSystemAddress,
    NativeBitStream,
    encodeString,
    decodeString,
    buildWorldLoginBurst,
} from '@openfom/networking';
import { Connection, LoginPhase } from '../network/Connection';
import { APARTMENT_WORLD_TABLE } from '../world/WorldRegistry';
import { info as logInfo } from '@openfom/utils';

export interface LoginHandlerConfig {
    serverMode: 'master' | 'world';
    worldIp: string;
    worldPort: number;
    debug: boolean;
    loginDebug?: boolean;
    loginStrict?: boolean;
    loginRequireCredentials?: boolean;
    acceptLoginAuthWithoutUser?: boolean;
    resendDuplicateLogin6D?: boolean;
    loginClientVersion?: number;
    worldSelectWorldId?: number;
    worldSelectWorldInst?: number;
    worldSelectPlayerId?: number;
    worldSelectPlayerIdRandom?: boolean;
    worldLoginWorldConst?: number;
}

export interface LoginResponse {
    data: Buffer;
    address: RakSystemAddress;
}

export class LoginHandler {
    private config: LoginHandlerConfig;
    private apartmentInstByConn: Map<string, number> = new Map();
    private apartmentInstCounts: Map<number, number> = new Map();
    private apartmentInstList: number[] = [];

    constructor(config: LoginHandlerConfig) {
        this.config = config;
        this.apartmentInstList = Object.keys(APARTMENT_WORLD_TABLE)
            .map((key) => Number.parseInt(key, 10))
            .filter((value) => Number.isFinite(value) && value > 0)
            .sort((a, b) => a - b);
    }

    // Reserve a worldInst for apartment worlds (worldId=4). Uses least-loaded inst id.
    private allocApartmentInst(connection: Connection): number {
        const existing = this.apartmentInstByConn.get(connection.key);
        if (existing !== undefined) {
            return existing;
        }
        if (this.apartmentInstList.length === 0) {
            return 0;
        }
        let chosen = this.apartmentInstList[0];
        let bestCount = this.apartmentInstCounts.get(chosen) ?? 0;
        for (const inst of this.apartmentInstList) {
            const count = this.apartmentInstCounts.get(inst) ?? 0;
            if (count < bestCount) {
                bestCount = count;
                chosen = inst;
            }
        }
        this.apartmentInstByConn.set(connection.key, chosen);
        this.apartmentInstCounts.set(chosen, bestCount + 1);
        return chosen;
    }

    // Release a previously reserved apartment inst.
    private releaseApartmentInst(connection: Connection): void {
        const inst = this.apartmentInstByConn.get(connection.key);
        if (inst === undefined) {
            return;
        }
        this.apartmentInstByConn.delete(connection.key);
        const count = (this.apartmentInstCounts.get(inst) ?? 1) - 1;
        if (count > 0) {
            this.apartmentInstCounts.set(inst, count);
        } else {
            this.apartmentInstCounts.delete(inst);
        }
    }

    // External hook for connection teardown.
    releaseConnection(connection: Connection): void {
        this.releaseApartmentInst(connection);
    }

    /**
     * Check if a packet ID is part of the login flow
     */
    isLoginPacket(packetId: number): boolean {
        return (
            packetId === RakNetMessageId.ID_LOGIN_REQUEST ||
            packetId === RakNetMessageId.ID_LOGIN ||
            packetId === RakNetMessageId.ID_LOGIN_TOKEN_CHECK ||
            packetId === RakNetMessageId.ID_WORLD_LOGIN
        );
    }

    /**
     * Handle a login-related packet
     */
    handle(
        packetId: number,
        data: Uint8Array,
        connection: Connection,
    ): LoginResponse | LoginResponse[] | null {
        switch (packetId) {
            case RakNetMessageId.ID_LOGIN_REQUEST:
                return this.handleLoginRequest(data, connection);
            case RakNetMessageId.ID_LOGIN:
                return this.handleLoginAuth(data, connection);
            case RakNetMessageId.ID_LOGIN_TOKEN_CHECK:
                return this.handleLoginTokenCheck(data, connection);
            case RakNetMessageId.ID_WORLD_LOGIN:
                return this.handleWorldLogin(data, connection);
            default:
                return null;
        }
    }

    // =========================================================================
    // 0x6C - Login Request
    // =========================================================================

    /**
     * Handle 0x6C - Login request with username
     *
     * Packet format (ID_LOGIN_REQUEST 0x6C):
     *   - username (Huffman with raw u32 BE bit count prefix)
     *   - clientVersion (raw u16, 16 bits)
     *
     * See: Docs/Packets/ID_LOGIN_REQUEST.md
     */
    private handleLoginRequest(data: Uint8Array, connection: Connection) {
        const packetId = data[0];
        this.log(`[Login] 0x${packetId.toString(16)} from ${connection.key} (${data.length} bytes)`);

        // Debug: dump raw bytes
        if (this.config.debug) {
            const hex = Array.from(data.slice(0, Math.min(32, data.length)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
            this.log(`[Login] raw: ${hex}`);
        }

        let username = '';
        let clientVersion = 0;
        let parseSuccess = false;

        // Handle timestamp prefix first (RakNet optional ID_TIMESTAMP wrapper).
        let actualPacketId = packetId;
        let dataOffset = 0;
        if (packetId === RakNetMessageId.ID_TIMESTAMP && data.length > 9) {
            // Skip timestamp header: 1 byte (0x19) + 8 bytes (u64 timestamp)
            dataOffset = 9;
            actualPacketId = data[9];
        }

        // Parse 0x6C packet
        if (actualPacketId === RakNetMessageId.ID_LOGIN_REQUEST) {
            const bs = new NativeBitStream(Buffer.from(data.slice(dataOffset)), true);
            try {
                bs.readU8(); // Skip packet ID (0x6C)

                // Decode Huffman-encoded username
                username = decodeString(bs, 2048);
                this.log(`[Login6C] Huffman decoded: user="${username}"`);

                // Read u16 token/version (16 bits, MSB-first)
                clientVersion = bs.readCompressedU16();
                parseSuccess = true;
                this.log(`[Login6C] Raw U32BE format: user="${username}" ver=${clientVersion}`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.log(`[Login6C] Parse failed: ${msg}`);
            } finally {
                bs.destroy();
            }
        }

        const strictLogin = this.config.loginStrict ?? false;

        if (!parseSuccess || !username || username.length < 3) {
            this.log(`[Login] Failed to parse username from packet`);
            if (strictLogin) {
                return {
                    data: this.buildLoginRequestReturn(LoginRequestReturnStatus.INVALID_INFO, ''),
                    address: connection.address,
                };
            }
            return null;
        }

        // Validate username shape and length.
        const maxUserLen = strictLogin ? 32 : 64;
        if (!this.isPrintableAscii(username) || username.length > maxUserLen) {
            this.log(`[Login] reject invalid username len=${username.length}`);
            if (strictLogin) {
                return {
                    data: this.buildLoginRequestReturn(LoginRequestReturnStatus.INVALID_INFO, ''),
                    address: connection.address,
                };
            }
            return null;
        }

        // Validate client version if strict mode is enabled.
        if (strictLogin && !this.isClientVersionAllowed(clientVersion)) {
            this.log(`[Login] reject clientVersion=${clientVersion}`);
            return {
                data: this.buildLoginRequestReturn(LoginRequestReturnStatus.OUTDATED_CLIENT, username),
                address: connection.address,
            };
        }

        // Check cooldown to avoid rapid duplicate 0x6D responses.
        const now = Date.now();
        const cooldownMs = 2000;
        if (connection.lastLoginResponseSentAt && now - connection.lastLoginResponseSentAt < cooldownMs) {
            this.log(`[Login] cooldown skip user="${username}"`);
            return null;
        }

        // Check if already authenticated.
        if (connection.loginPhase === LoginPhase.AUTHENTICATED) {
            this.log(`[Login] already authenticated user="${username}"`);
            if (strictLogin) {
                return {
                    data: this.buildLoginRequestReturn(
                        LoginRequestReturnStatus.ALREADY_LOGGED_IN,
                        connection.username || username,
                    ),
                    address: connection.address,
                };
            }
            return null;
        }

        // Handle duplicate pending request.
        if (connection.loginPhase === LoginPhase.USER_SENT && connection.pendingLoginUser === username) {
            if (!this.config.resendDuplicateLogin6D) {
                this.log(`[Login] duplicate pending -> skip resend`);
                return null;
            }
            this.log(`[Login] duplicate pending -> resend 0x6D`);
        }

        // Store pending login info for the 0x6E auth step.
        connection.pendingLoginUser = username;
        connection.pendingLoginClientVersion = clientVersion;
        connection.pendingLoginAt = Date.now();
        connection.loginPhase = LoginPhase.USER_SENT;

        this.log(`[Login] Success: user="${username}" ver=${clientVersion}`);

        // Build 0x6D response.
        const response = this.buildLoginRequestReturn(LoginRequestReturnStatus.SUCCESS, username);
        connection.lastLoginResponseSentAt = Date.now();

        return {
            data: response,
            address: connection.address,
        };
    }

    private isPrintableAscii(value: string): boolean {
        for (let i = 0; i < value.length; i++) {
            const c = value.charCodeAt(i);
            if (c < 0x20 || c > 0x7e) return false;
        }
        return true;
    }

    private isClientVersionAllowed(clientVersion: number): boolean {
        const expected = this.config.loginClientVersion ?? 0;
        if (expected <= 0) {
            return true;
        }
        return clientVersion === expected;
    }

    private evaluateLoginAuthStatus(
        connection: Connection,
        username: string,
        passwordHash: string,
    ): LoginReturnStatus {
        // Centralized gate for strict auth decisions.
        if (!username || username.length < 3 || username.length > 32 || !this.isPrintableAscii(username)) {
            return LoginReturnStatus.UNKNOWN_USERNAME;
        }
        if (connection.pendingLoginUser && connection.pendingLoginUser !== username) {
            return LoginReturnStatus.INVALID_LOGIN;
        }
        if (this.config.loginRequireCredentials) {
            if (!passwordHash || passwordHash.length === 0) {
                return LoginReturnStatus.INCORRECT_PASSWORD;
            }
        }
        return LoginReturnStatus.SUCCESS;
    }

    /**
     * Build 0x6D LOGIN_REQUEST_RETURN response using native RakNet BitStream
     *
     * Packet format:
     *   - status (compressed u8)
     *   - username (StringCompressor, max 2048)
     *
     * See: Docs/Packets/ID_LOGIN_REQUEST_RETURN.md
     */
    private buildLoginRequestReturn(status: LoginRequestReturnStatus, username: string): Buffer {
        const bs = new NativeBitStream();

        try {
            bs.writeU8(RakNetMessageId.ID_LOGIN_REQUEST_RETURN);
            bs.writeCompressedU8(status & 0xff);
            encodeString(username ?? '', bs, 2048);

            const payload = bs.getData();

            // Debug: dump raw bytes
            if (this.config.debug) {
                const hex = Array.from(payload.slice(0, Math.min(32, payload.length)))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join(' ');
                this.log(`[Login6D] raw: ${hex}`);
            }

            this.log(`[Login6D] build status=${status} user="${username}" len=${payload.length}`);
            return payload;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.log(`[Login6D] build exception: ${msg}`);
            return Buffer.alloc(0);
        } finally {
            bs.destroy();
        }
    }


    // =========================================================================
    // 0x6E - Login Authentication
    // =========================================================================

    /**
     * Handle 0x6E - Login authentication packet
     *
     * Packet format (ID_LOGIN 0x6E):
     *   - username (StringCompressor)
     *   - passwordHash (bounded string, 64 bytes)
     *   - fileCRCs[3] (compressed u32)
     *   - macAddress (StringCompressor)
     *   - driveModels[4] (bounded string, 64 bytes each)
     *   - driveSerialNumbers[4] (bounded string, 32 bytes each)
     *   - loginToken (bounded string, 64 bytes)
     *   - computerName (StringCompressor)
     *   - hasSteamTicket (bit)
     *   - [if hasSteamTicket] steamTicket (1024 compressed bytes) + steamTicketLength (compressed u32)
     *
     * See: Docs/Packets/ID_LOGIN.md
     */
    private handleLoginAuth(data: Uint8Array, connection: Connection) {
        this.log(`[Login] 0x6E from ${connection.key} (${data.length} bytes)`);

        if (connection.loginPhase !== LoginPhase.USER_SENT && !this.config.acceptLoginAuthWithoutUser) {
            this.log(`[Login6E] unexpected - phase=${connection.loginPhase}`);
            return null;
        }

        let username = '';
        let computerName = '';
        let macAddress = '';
        let loginToken = '';
        let passwordHash = '';
        const fileCRCs: number[] = [];
        const driveModels: string[] = [];
        const driveSerials: string[] = [];
        let hasSteamTicket = false;
        let steamTicketLength = 0;

        let bs: NativeBitStream | null = null;
        try {
            bs = new NativeBitStream(Buffer.from(data), true);
            let packetId = bs.readU8(); // Skip packet ID

            // Handle timestamp prefix if present
            if (packetId === RakNetMessageId.ID_TIMESTAMP) {
                bs.readBytes(8); // Skip 8-byte timestamp
                packetId = bs.readU8(); // Read actual packet ID
            }

            // Parse according to Docs/Packets/ID_LOGIN.md
            username = decodeString(bs, 2048);
            passwordHash = bs.readString(64, 'hex')

            // Read 3 file CRCs
            for (let i = 0; i < 3; i++) {
                fileCRCs.push(bs.readCompressedU32());
            }

            macAddress = decodeString(bs, 2048);

            // Read 4 drive models and serial numbers
            for (let i = 0; i < 4; i++) {
                driveModels.push(bs.readString(64));
                driveSerials.push(bs.readString(32));
            }

            loginToken = bs.readString(64);
            computerName = decodeString(bs, 2048);

            hasSteamTicket = bs.readBit();
            if (hasSteamTicket) {
                // Read 1024 compressed bytes
                for (let i = 0; i < 1024; i++) {
                    bs.readCompressedU8();
                }
                steamTicketLength = bs.readCompressedU32();
            }
        } catch {
            // Best-effort parse - continue with what we got
        } finally {
            bs?.destroy();
        }

        // Fall back to pending username if not parsed
        if (!username && connection.pendingLoginUser) {
            username = connection.pendingLoginUser;
        }

        // Store auth details
        connection.loginAuthUsername = username;
        connection.loginAuthComputer = computerName;
        connection.loginAuthPasswordHash = passwordHash;
        connection.loginAuthMacAddress = macAddress;
        connection.loginAuthLoginToken = loginToken;
        connection.loginAuthFileCRCs = fileCRCs;
        connection.loginAuthSteamTicket = hasSteamTicket;
        connection.loginAuthSteamTicketLength = steamTicketLength;

        const strictLogin = this.config.loginStrict ?? false;
        const status = strictLogin
            ? this.evaluateLoginAuthStatus(connection, username, passwordHash)
            : LoginReturnStatus.SUCCESS;
        const loginClientVersion = connection.pendingLoginClientVersion || 0;

        const crcNote = fileCRCs.length > 0 ? fileCRCs.map((v) => `0x${v.toString(16)}`).join(',') : 'none';
        this.log(
            `[Login6E] auth status=${status} user="${username}" hash="${passwordHash.slice(0,16)}..." mac="${macAddress}" crcs=[${crcNote}] token="${loginToken}" macAddress=[${macAddress}] drives=[${driveModels},${driveSerials}]`,
        );

        if (status === LoginReturnStatus.SUCCESS) {
            connection.username = username;
            connection.authenticated = true;
            connection.authenticatedUser = username;
            connection.loginPhase = LoginPhase.AUTHENTICATED;
            connection.pendingLoginUser = '';
            connection.pendingLoginClientVersion = 0;
            connection.pendingLoginAt = 0;
        } else {
            connection.authenticated = false;
            connection.loginPhase = LoginPhase.USER_SENT;
        }

        // In master mode, send 0x6F after authentication decision (+ 0x7B world select on success).
        if (this.config.serverMode === 'master') {
            const playerId = status === LoginReturnStatus.SUCCESS
                ? this.resolveWorldSelectPlayerId(connection)
                : 0;
            const worldId = this.resolveWorldSelectWorldId(connection);
            const worldInst = this.resolveWorldSelectWorldInst(connection, worldId);
            connection.worldSelectWorldId = worldId;
            connection.worldSelectWorldInst = worldInst;

            const loginReturn = this.buildLoginReturn({
                status,
                playerId,
                clientVersion: loginClientVersion,
            });

            this.log(`[Login6E] -> 0x6F status=${status} playerId=${playerId} world=${worldId}:${worldInst}`);
            const responses: LoginResponse[] = [
                {
                    data: loginReturn,
                    address: connection.address,
                },
            ];

            if (status === LoginReturnStatus.SUCCESS) {
                const worldSelect = this.buildWorldSelect(playerId, worldId, worldInst);
                connection.worldSelectSent = true;
                this.log(`[Login6E] -> 0x7B subId=4 playerId=${playerId} world=${worldId}:${worldInst}`);
                responses.push({
                    data: worldSelect,
                    address: connection.address,
                });
            }

            return responses;
        }

        return null;
    }

    /**
     * Build 0x6F LOGIN_RETURN response
     *
     * See: Docs/Packets/ID_LOGIN_RETURN.md
     */
    private buildLoginReturn(options: {
        status: LoginReturnStatus;
        playerId: number;
        clientVersion: number;
        accountType?: AccountType;
        field4?: boolean;
        field5?: boolean;
        isBanned?: boolean;
    }): Buffer {
        // 0x6F payload uses native BitStream for exact RakNet compatibility.
        const bs = new NativeBitStream();
        bs.writeU8(RakNetMessageId.ID_LOGIN_RETURN);
        bs.writeCompressedU8(options.status & 0xff);
        bs.writeCompressedU32(options.playerId >>> 0);

        if (options.playerId !== 0) {
            const accountType = options.accountType ?? AccountType.FREE;
            bs.writeCompressedU8(accountType & 0xff);
            bs.writeBit(Boolean(options.field4));
            bs.writeBit(Boolean(options.field5));
            bs.writeCompressedU16(options.clientVersion & 0xffff);

            const isBanned = Boolean(options.isBanned);
            bs.writeBit(isBanned);
            if (isBanned) {
                encodeString('0', bs, 2048, 0); // banLength
                encodeString('', bs, 2048, 0); // banReason
            }

            // worldIDs vector (count + ids)
            bs.writeCompressedU8(0);
            // factionMOTD
            encodeString('', bs, 2048, 0);
            // apartment (minimal stub)
            this.writeApartmentStubNative(bs);
            // field_final1, field_final2
            bs.writeCompressedU8(0);
            bs.writeCompressedU8(0);
        }

        const payload = bs.getData();
        if (this.config.debug) {
            this.debugDecodeLoginReturn(payload);
        }
        bs.destroy();
        return payload;
    }

    private debugDecodeLoginReturn(payload: Buffer): void {
        // Debug-only round-trip decode to verify the encoder.
        try {
            const bs = new NativeBitStream(payload, true);
            const packetId = bs.readU8();
            if (packetId !== RakNetMessageId.ID_LOGIN_RETURN) {
                this.log(`[Login6F] decode failed: bad id=0x${packetId.toString(16)}`);
                bs.destroy();
                return;
            }
            const status = bs.readCompressedU8();
            const playerId = bs.readCompressedU32();
            let accountType = 0;
            let clientVersion = 0;
            let field4 = false;
            let field5 = false;
            let isBanned = false;
            if (playerId !== 0) {
                accountType = bs.readCompressedU8();
                field4 = bs.readBit();
                field5 = bs.readBit();
                clientVersion = bs.readCompressedU16();
                isBanned = bs.readBit();
            }
            bs.destroy();
            this.log(
                `[Login6F] decode status=${status} playerId=${playerId} accountType=${accountType} field4=${field4} field5=${field5} clientVersion=${clientVersion} banned=${isBanned}`,
            );
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.log(`[Login6F] decode exception: ${msg}`);
        }
    }

    private writeApartmentStubNative(writer: NativeBitStream): void {
        writer.writeCompressedU32(0); // id
        writer.writeCompressedU8(0); // type
        writer.writeCompressedU32(0); // ownerPlayerID
        writer.writeCompressedU32(0); // ownerFactionID
        writer.writeCompressedU8(0); // allowedRanks vector count
        writer.writeBit(false); // isOpen
        encodeString('', writer, 2048, 0); // ownerName
        encodeString('', writer, 2048, 0); // entryCode
        // storage ItemList (minimal)
        writer.writeCompressedU16(0); // capacity
        writer.writeCompressedU32(0); // field_14
        writer.writeCompressedU32(0); // field_18
        writer.writeCompressedU32(0); // field_1C
        writer.writeCompressedU16(0); // itemCount
        writer.writeBit(false); // hasPublicInfo
        writer.writeCompressedU32(0); // entryPrice
        encodeString('', writer, 2048, 0); // publicName
        encodeString('', writer, 2048, 0); // publicDescription
        writer.writeCompressedU32(0); // allowedFactions map count
        writer.writeBit(false); // isDefault
        writer.writeBit(false); // isFeatured
        writer.writeCompressedU32(0); // occupancy
    }

    // =========================================================================
    // 0x70 - Login Token Check
    // =========================================================================

    /**
     * Handle 0x70 - Login token check (bidirectional)
     *
     * Packet format:
     *   - fromServer (bit)
     *   - [if fromServer] success (bit) + username (bounded string, 32 bytes)
     *   - [if !fromServer] requestToken (bounded string, 32 bytes)
     *
     * See: Docs/Packets/ID_LOGIN_TOKEN_CHECK.md
     */
    private handleLoginTokenCheck(data: Uint8Array, connection: Connection): LoginResponse | null {
        this.log(`[Login] 0x70 from ${connection.key} (${data.length} bytes)`);

        const bs = new NativeBitStream(Buffer.from(data), true);
        try {
            bs.readU8(); // Skip packet ID

            const fromServer = bs.readBit();
            if (fromServer) {
                // Server -> Client (we received this - shouldn't happen on server)
                const success = bs.readBit();
                const username = bs.readString(32);
                this.log(`[Login70] recv server->client success=${success} user="${username}"`);
                return null;
            }

            // Client -> Server
            const requestToken = bs.readString(32);
            const username = connection.pendingLoginUser || connection.username || '';

            this.log(`[Login70] token="${requestToken}" -> respond with user="${username}"`);

            // Build response
            const response = this.buildLoginTokenCheckResponse(true, username);
            return {
                data: response,
                address: connection.address,
            };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.log(`[Login70] parse error: ${msg}`);
            return null;
        } finally {
            bs.destroy();
        }
    }

    private buildLoginTokenCheckResponse(success: boolean, username: string): Buffer {
        const bs = new NativeBitStream();
        try {
            bs.writeU8(RakNetMessageId.ID_LOGIN_TOKEN_CHECK);
            bs.writeBit(true); // fromServer
            bs.writeBit(Boolean(success));
            bs.writeString(username ?? '', 32);
            return bs.getData();
        } finally {
            bs.destroy();
        }
    }

    // =========================================================================
    // 0x72 - World Login
    // =========================================================================

    /**
     * Handle 0x72 - World login
     */
    private handleWorldLogin(data: Uint8Array, connection: Connection): LoginResponse | LoginResponse[] | null {
        this.log(`[Login] 0x72 from ${connection.key} (${data.length} bytes)`);

        const bs = new NativeBitStream(Buffer.from(data), true);
        try {
            bs.readU8(); // Skip packet ID

            const worldId = bs.readCompressedU8();
            const worldInst = bs.readCompressedU8();
            const playerId = bs.readCompressedU32();
            const worldConst = bs.readCompressedU32();

            connection.worldId = worldId;
            connection.worldInst = worldInst;
            connection.playerId = playerId;
            connection.worldLoginWorldId = worldId;
            connection.worldLoginWorldInst = worldInst;
            connection.worldLoginPlayerId = playerId;
            connection.worldLoginWorldConst = worldConst;

            this.log(`[Login72] worldId=${worldId} inst=${worldInst} playerId=${playerId} const=0x${worldConst.toString(16)}`);

            // In master mode, send world redirect (0x73).
            if (this.config.serverMode === 'master') {
                if (!connection.authenticated) {
                    this.log(`[Login72] ignore unauth`);
                    return null;
                }

                // 0x73 codes -> UI messages (see Docs/Packets/ID_WORLD_LOGIN_RETURN.md)
                // 1: success (connect to world)
                // 2: server unavailable
                // 3: faction not available
                // 4: world full
                // 6: faction privileges revoked
                // 7: vortex gate range error
                // 8: retry later
                // TODO: This is where the DB read will happen to retrieve account details.
                const code = this.resolveWorldLoginReturnCode(connection);
                switch (code) {
                    case 1:
                        // success
                        break;
                    case 2:
                        // server unavailable
                        break;
                    case 3:
                        // faction not available
                        break;
                    case 4:
                        // world full
                        break;
                    case 6:
                        // faction privileges revoked
                        break;
                    case 7:
                        // vortex gate range error
                        break;
                    case 8:
                        // retry later
                        break;
                    default:
                        // unknown error
                        break;
                }
                const response = this.buildWorldLoginReturn(
                    code === 1,
                    this.config.worldIp,
                    this.config.worldPort,
                    { code, flag: 0xff },
                );
                this.log(`[Login72] -> 0x73 code=${code} world=${this.config.worldIp}:${this.config.worldPort}`);
                return {
                    data: response,
                    address: connection.address,
                };
            }

            // In world mode, accept and send LithTech burst.
            connection.authenticated = true;
            connection.loginPhase = LoginPhase.IN_WORLD;
            if (!connection.worldTimeOrigin) {
                connection.worldTimeOrigin = Date.now();
            }
            connection.worldLastHeartbeatAt = 0;

            const responses: LoginResponse[] = [];

            // Build 0x73 response.
            const response = this.buildWorldLoginReturn(true, this.config.worldIp, this.config.worldPort, {
                code: 1,
                flag: 0xff,
            });
            responses.push({
                data: response,
                address: connection.address,
            });

            // Send LithTech burst (NETPROTOCOLVERSION + YOURID + CLIENTOBJECTID + LOADWORLD).
            const seq = connection.lithTechOutSeq;
            connection.lithTechOutSeq = (seq + 1) & 0x1fff;

            const clientId = connection.id;
            const objectId = playerId || connection.id;
            const lithWorldId = worldId || 16;

            const lithBurst = buildWorldLoginBurst(seq, clientId, objectId, lithWorldId);
            const wrappedBurst = Buffer.concat([Buffer.from([RakMessageId.USER_PACKET_ENUM]), lithBurst]);
            this.log(`[Login72] -> LithTech burst (${lithBurst.length} bytes)`);

            responses.push({
                data: wrappedBurst,
                address: connection.address,
            });

            return responses;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.log(`[Login72] parse error: ${msg}`);
            return null;
        } finally {
            bs.destroy();
        }
    }

    /**
     * Build 0x73 WORLD_LOGIN_RETURN response
     */
    private buildWorldLoginReturn(
        success: boolean,
        worldIp: string,
        worldPort: number,
        options?: { code?: number; flag?: number },
    ): Buffer {
        const bs = new NativeBitStream();
        try {
            bs.writeU8(RakNetMessageId.ID_WORLD_LOGIN_RETURN);
            const code = options?.code ?? (success ? 1 : 0);
            const flag = options?.flag ?? 0xff;
            bs.writeCompressedU8(code & 0xff);
            bs.writeCompressedU8(flag & 0xff);
            const ipU32 = this.ipv4ToU32BE(worldIp);
            bs.writeCompressedU32(ipU32 >>> 0);
            bs.writeCompressedU16(worldPort & 0xffff);
            return bs.getData();
        } finally {
            bs.destroy();
        }
    }

    /**
     * Build 0x7B WORLD_SELECT packet
     */
    buildWorldSelect(playerId: number, worldId: number, worldInst: number): Buffer {
        const bs = new NativeBitStream();
        try {
            bs.writeU8(RakNetMessageId.ID_WORLD_SELECT);
            bs.writeCompressedU32(playerId >>> 0);
            bs.writeCompressedU8(4); // subId=4 -> worldId/worldInst
            bs.writeCompressedU8(worldId & 0xff);
            bs.writeCompressedU8(worldInst & 0xff);
            return bs.getData();
        } finally {
            bs.destroy();
        }
    }

    private resolveWorldLoginReturnCode(connection: Connection): number {
        // Scaffolding: map future server-side checks to client UI codes.
        // TODO: replace these stubs with real validation signals.
        if (!connection.authenticated) {
            return 2; // server unavailable / not authorized
        }
        switch (connection.worldConnectStage) {
            case 2:
                return 2; // server unavailable
            case 3:
                return 3; // faction not available
            case 4:
                return 4; // world full
            case 6:
                return 6; // faction privileges revoked
            case 7:
                return 7; // vortex gate range error
            case 8:
                return 8; // retry later
            default:
                break;
        }
        return 1;
    }

    // =========================================================================
    // Utility Methods
    // =========================================================================

    private resolveWorldSelectPlayerId(connection: Connection): number {
        if (this.config.worldSelectPlayerId && this.config.worldSelectPlayerId > 0) {
            connection.worldSelectPlayerId = this.config.worldSelectPlayerId >>> 0;
            return connection.worldSelectPlayerId;
        }
        if (connection.worldSelectPlayerId > 0) {
            return connection.worldSelectPlayerId;
        }
        let playerId = 0;
        if (this.config.worldSelectPlayerIdRandom) {
            playerId = (Math.random() * 0xfffe + 1) >>> 0;
        } else {
            playerId = connection.id;
        }
        if (playerId <= 0) {
            playerId = connection.id;
        }
        connection.worldSelectPlayerId = playerId >>> 0;
        return connection.worldSelectPlayerId;
    }

    private resolveWorldSelectWorldId(connection: Connection): number {
        if (connection.worldSelectWorldId > 0) {
            return connection.worldSelectWorldId;
        }
        const worldId = this.config.worldSelectWorldId ?? 0;
        if (worldId > 0) {
            connection.worldSelectWorldId = worldId >>> 0;
            return connection.worldSelectWorldId;
        }
        return 0;
    }

    private resolveWorldSelectWorldInst(connection: Connection, worldId: number): number {
        if (connection.worldSelectWorldInst > 0) {
            return connection.worldSelectWorldInst;
        }
        const worldInst = this.config.worldSelectWorldInst ?? 0;
        if (worldInst > 0) {
            connection.worldSelectWorldInst = worldInst >>> 0;
            return connection.worldSelectWorldInst;
        }
        if (worldId === 4) {
            connection.worldSelectWorldInst = this.allocApartmentInst(connection) >>> 0;
            return connection.worldSelectWorldInst;
        }
        return 0;
    }

    private ipv4ToU32BE(value: string): number {
        const parts = value.split('.');
        if (parts.length !== 4) return 0;
        const bytes = parts.map((part) => Number.parseInt(part, 10));
        if (bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255)) return 0;
        return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
    }

    private log(message: string): void {
        if (this.config.debug || this.config.loginDebug) {
            logInfo(message);
        }
    }
}
