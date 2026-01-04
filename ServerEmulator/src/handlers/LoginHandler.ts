import * as crypto from 'crypto';
import RakBitStream from '../raknet-js/structures/BitStream';
import { BitOrder } from '../protocol/BitOrder';
import { RakNetMessageId, LoginRequestReturnStatus, LoginReturnStatus } from '../protocol/Constants';
import { readCompressedString, writeCompressedString } from '../protocol/RakStringCompressor';
import { Connection, LoginPhase } from '../network/Connection';
import { APARTMENT_WORLD_TABLE } from '../world/WorldRegistry';

type LoginHandlerHooks = {
    wrapReliable: (innerData: Buffer, connection: Connection) => Buffer;
    ensureBitOrder?: (actual: BitOrder | undefined, expected: BitOrder, context: string) => void;
    realignMsbBuffer?: (buffer: Buffer, bitOffset: number) => Buffer;
    logBits?: (tag: string, buffer: Buffer, bits: number) => void;
    onAuthenticated?: (connection: Connection, wasAuth: boolean) => Buffer | null;
};

type LoginHandlerConfig = {
    serverMode: 'master' | 'world';
    loginDebug: boolean;
    verbose: boolean;
    worldIp: string;
    worldPort: number;
    loginResponseMinimal: boolean;
    loginResponseTimestamp: boolean;
    loginRequireCredentials: boolean;
    acceptLoginAuthWithoutUser: boolean;
    resendDuplicateLogin6D: boolean;
    worldSelectWorldId: number;
    worldSelectWorldInst: number;
    worldSelectPlayerId: number;
    worldSelectPlayerIdRandom: boolean;
    worldLoginWorldConst: number;
};

export class LoginHandler {
    private hooks: LoginHandlerHooks;
    private config: LoginHandlerConfig;
    private apartmentInstByConn: Map<string, number> = new Map();
    private apartmentInstCounts: Map<number, number> = new Map();
    private apartmentInstList: number[] = [];

    // Build a handler with login parsing config and callbacks.
    constructor(config: LoginHandlerConfig, hooks: LoginHandlerHooks) {
        this.config = config;
        this.hooks = hooks;
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

    // Emit debug log lines when login debug is enabled.
    private logLoginDebug(message: string): void {
        if (this.config.loginDebug || this.config.verbose) {
            console.log(message);
        }
    }

    private pickRandomPlayerId(): number {
        const maxId = 0xfffe;
        return crypto.randomInt(1, maxId + 1) >>> 0;
    }

    private resolveWorldSelectPlayerId(connection: Connection): number {
        if (this.config.worldSelectPlayerId > 0) {
            connection.worldSelectPlayerId = this.config.worldSelectPlayerId >>> 0;
            return connection.worldSelectPlayerId;
        }
        if (connection.worldSelectPlayerId > 0) {
            return connection.worldSelectPlayerId;
        }
        let playerId = 0;
        if (this.config.worldSelectPlayerIdRandom) {
            // TODO(DB): replace random playerId with DB-backed account id (keep <= 0xFFFE).
            playerId = this.pickRandomPlayerId();
        } else {
            playerId = connection.id;
        }
        if (playerId <= 0) {
            playerId = connection.id;
        }
        connection.worldSelectPlayerId = playerId >>> 0;
        return connection.worldSelectPlayerId;
    }

    // Re-align a bitstream by discarding a number of MSB bits.
    private realignMsbBuffer(buffer: Buffer, bitOffset: number): Buffer {
        if (this.hooks.realignMsbBuffer) {
            return this.hooks.realignMsbBuffer(buffer, bitOffset);
        }
        const reader = new RakBitStream(buffer);
        if (bitOffset > 0) {
            reader.readBits(bitOffset);
        }
        const writer = new RakBitStream();
        const totalBits = Math.max(0, buffer.length * 8 - bitOffset);
        for (let i = 0; i < totalBits; i += 1) {
            writer.writeBit(reader.readBit() === 1);
        }
        const outBits = Math.max(0, writer.bits());
        const outBytes = Math.ceil(outBits / 8);
        return writer.data.subarray(0, outBytes);
    }

    // Read a bounded byte array using a bit-length prefix.
    private readBoundedBytes(stream: RakBitStream, maxLen: number): Buffer {
        if (maxLen <= 1) {
            return Buffer.alloc(0);
        }
        const bits = Math.floor(Math.log2(maxLen)) + 1;
        const len = stream.readBits(bits);
        const rawLen = Math.max(0, len);
        const safeLen = Math.min(rawLen, maxLen - 1);
        const bytes: number[] = [];
        for (let i = 0; i < rawLen; i += 1) {
            const byte = stream.readBits(8);
            if (i < safeLen) {
                bytes.push(byte);
            }
        }
        return Buffer.from(bytes);
    }

    // Read a bounded ASCII string using a bit-length prefix.
    private readBoundedString(stream: RakBitStream, maxLen: number): string {
        return this.readBoundedBytes(stream, maxLen).toString('latin1');
    }

    // Write a bounded ASCII string using a bit-length prefix.
    private writeBoundedString(stream: RakBitStream, value: string, maxLen: number): void {
        if (maxLen <= 1) {
            return;
        }
        const raw = Buffer.from(value ?? '', 'latin1');
        let length = raw.length;
        if (length >= maxLen) {
            length = maxLen - 1;
        }
        const bits = Math.floor(Math.log2(maxLen)) + 1;
        stream.writeBits(length, bits);
        for (let i = 0; i < length; i += 1) {
            stream.writeBits(raw[i], 8);
        }
    }

    // Read a compressed unsigned integer (RakNet "compressed") of size bytes.
    private readCompressedUInt(stream: RakBitStream, size: number): number {
        const comp = stream.readCompressed(size);
        let value = 0;
        let factor = 1;
        for (let i = 0; i < size; i += 1) {
            value += comp.readByte() * factor;
            factor *= 256;
        }
        return value >>> 0;
    }



    // Parse dotted IPv4 string into byte array.
    private parseIpv4Bytes(value: string): number[] | null {
        const parts = value.split('.');
        if (parts.length !== 4) return null;
        const bytes = parts.map((part) => Number.parseInt(part, 10));
        if (bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255)) return null;
        return bytes;
    }

    // Convert IPv4 string to BE u32 (so LE byte write yields correct host-order IP).
    private ipv4ToU32BE(value: string): number {
        const bytes = this.parseIpv4Bytes(value);
        if (!bytes) return 0;
        return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
    }

    // Fast ASCII sanity check used for candidate strings.
    private isPrintableAscii(value: string): boolean {
        for (let i = 0; i < value.length; i += 1) {
            const c = value.charCodeAt(i);
            if (c < 0x20 || c > 0x7e) return false;
        }
        return true;
    }

    // === Login Flow (ordered: 0x6B -> 0x6D -> 0x6E -> 0x6F -> 0x72 -> 0x73, optional 0x70) ===

    // Check whether a packet ID belongs to the login flow for the current server mode.
    isLoginRequestId(packetId: number): boolean {
        if (this.config.serverMode === 'world') {
            return (
                packetId === RakNetMessageId.ID_LOGIN ||
                packetId === RakNetMessageId.ID_WORLD_LOGIN
            );
        }
        return (
            packetId === RakNetMessageId.ID_LOGIN_REQUEST ||
            packetId === RakNetMessageId.ID_LOGIN ||
            packetId === RakNetMessageId.ID_LOGIN_TOKEN_CHECK ||
            packetId === RakNetMessageId.ID_WORLD_LOGIN
        );
    }

    // Parse login-related packets from a RakNet bitstream buffer (entry point).
    tryParseLoginRequestRak(
        buffer: Buffer,
        connection: Connection,
        source: string,
        options?: { dryRun?: boolean; bitOffset?: number; tracePath?: string },
    ): Buffer | null {
        if (buffer.length < 2) {
            return null;
        }
        const dryRun = options?.dryRun === true;
        const bitOffset = Math.max(0, Math.min(7, options?.bitOffset ?? 0));
        const totalBits = buffer.length * 8 - bitOffset;
        const pathTag = options?.tracePath || 'LoginHandler.tryParseLoginRequestRak';

        if (this.hooks.logBits) {
            this.hooks.logBits(
                `[LoginReq] ${connection.key} src=${source}`,
                buffer,
                buffer.length * 8,
            );
        }

        const alignedBuffer = bitOffset > 0 ? this.realignMsbBuffer(buffer, bitOffset) : buffer;
        const stream = new RakBitStream(alignedBuffer);
        if (this.hooks.ensureBitOrder) {
            this.hooks.ensureBitOrder(
                (stream as unknown as { bitOrder?: BitOrder }).bitOrder,
                'msb',
                `${pathTag}:RakBitStream`,
            );
        }

        let packetId = stream.readByte();
        if (packetId === RakNetMessageId.ID_TIMESTAMP) {
            if (totalBits < 80) {
                return null;
            }
            stream.readLongLong();
            packetId = stream.readByte();
        }

        if (packetId === RakNetMessageId.ID_WORLD_LOGIN) {
            const info = this.parseWorldLogin(stream, connection, source, dryRun);
            if (!info || dryRun) {
                return null;
            }
            const expectedPlayerId =
                this.config.worldSelectPlayerId > 0
                    ? this.config.worldSelectPlayerId
                    : connection.worldSelectPlayerId;
            if (expectedPlayerId > 0 && info.playerId !== expectedPlayerId) {
                this.logLoginDebug(
                    `[Login72] playerId mismatch src=${source} got=${info.playerId} expected=${expectedPlayerId}`,
                );
                return null;
            }
            if (
                this.config.worldLoginWorldConst !== 0 &&
                info.worldConst !== 0 &&
                info.worldConst !== this.config.worldLoginWorldConst
            ) {
                this.logLoginDebug(
                    `[Login72] worldConst mismatch src=${source} got=0x${info.worldConst.toString(
                        16,
                    )} expected=0x${this.config.worldLoginWorldConst.toString(16)}`,
                );
            }
            if (this.config.serverMode === 'master') {
                if (!connection.authenticated) {
                    this.logLoginDebug(
                        `[Login72] ignore unauth src=${source} playerId=${info.playerId}`,
                    );
                    return null;
                }
                const response = this.buildWorldLoginReturn(
                    true,
                    this.config.worldIp,
                    this.config.worldPort,
                );
                this.logLoginDebug(
                    `[Login72] world login ok -> 0x73 world=${this.config.worldIp}:${this.config.worldPort} playerId=${info.playerId} worldId=${info.worldId} inst=${info.worldInst}`,
                );
                return this.hooks.wrapReliable(response, connection);
            }

            const wasAuth = connection.authenticated;
            connection.authenticated = true;
            connection.loginPhase = LoginPhase.AUTHENTICATED;
            connection.worldLoginWorldId = info.worldId;
            connection.worldLoginWorldInst = info.worldInst;
            connection.worldLoginPlayerId = info.playerId;
            connection.worldLoginWorldConst = info.worldConst;
            this.logLoginDebug(
                `[Login72] world login accepted src=${source} playerId=${info.playerId} worldId=${info.worldId} inst=${info.worldInst}`,
            );
            if (this.hooks.onAuthenticated) {
                const response = this.hooks.onAuthenticated(connection, wasAuth);
                if (response) return response;
            }
            return null;
        }

        if (packetId === RakNetMessageId.ID_LOGIN) {
            const wasAuth = connection.authenticated;
            this.parseLoginAuth(stream, connection, source, dryRun);
            if (!dryRun && connection.authenticated) {
                if (this.config.serverMode === 'master') {
                    const loginReturn = this.buildLoginReturn({
                        status: LoginReturnStatus.SUCCESS,
                        playerId: this.resolveWorldSelectPlayerId(connection),
                        clientVersion: connection.pendingLoginClientVersion ?? 0,
                    });
                    this.logLoginDebug(
                        `[Login6E] auth ok -> 0x6F playerId=${connection.worldSelectPlayerId || 0}`,
                    );
                    return this.hooks.wrapReliable(loginReturn, connection);
                }
            }
            if (!dryRun && this.hooks.onAuthenticated) {
                const response = this.hooks.onAuthenticated(connection, wasAuth);
                if (response) return response;
            }
            return null;
        }

        if (packetId === RakNetMessageId.ID_LOGIN_TOKEN_CHECK) {
            return this.parseLoginTokenCheck(stream, connection, source, dryRun);
        }

        if (!this.isLoginRequestId(packetId)) {
            return null;
        }
        const minBytes = this.minParseBytesForPacketId(packetId);
        if (minBytes !== null && buffer.length < minBytes) {
            return null;
        }
        if (packetId === RakNetMessageId.ID_LOGIN_REQUEST) {
            return this.parseLoginRequest(stream, connection, source, dryRun);
        }

        return null;
    }

    // Enforce minimum byte requirements for known login packets.
    private minParseBytesForPacketId(packetId: number): number | null {
        if (packetId === RakNetMessageId.ID_LOGIN_REQUEST) {
            return 1;
        }
        if (packetId === RakNetMessageId.ID_LOGIN_TOKEN_CHECK) {
            return 1;
        }
        if (packetId === RakNetMessageId.ID_LOGIN) {
            return 1;
        }
        if (packetId === RakNetMessageId.ID_WORLD_LOGIN) {
            return 1;
        }
        return null;
    }

    // Parse 0x6B (LOGIN_REQUEST) and build 0x6D response when valid.
    // 0x6B payload (client -> master, MSB bit order):
    //   - username (RakNet StringCompressor, max 2048)
    //   - clientVersion (compressed u16)
    // 0x6D response (master -> client):
    //   - ID_LOGIN_REQUEST_RETURN
    //   - status (compressed u8)
    //   - username (RakNet StringCompressor, max 2048)
    parseLoginRequest(
        stream: RakBitStream,
        connection: Connection,
        source: string,
        dryRun: boolean,
    ): Buffer | null {
        try {
            const rawUser = readCompressedString(stream, 2048);
            const username = this.isPrintableAscii(rawUser) ? rawUser : '';
            const clientVersion = this.readCompressedUInt(stream, 2) & 0xffff;
            const validUser = username.length >= 3 && username.length <= 64;

            if (dryRun) {
                this.logLoginDebug(
                    `[Login6B] dryRun skip src=${source} user="${username}" ver=${clientVersion}`,
                );
                return null;
            }

            if (!validUser || !username) {
                this.logLoginDebug(
                    `[Login6B] reject src=${source} userLen=${username.length} ver=${clientVersion}`,
                );
                return null;
            }

            const now = Date.now();
            const cooldownMs = 2000;
            if (
                connection.lastLoginResponseSentAt &&
                now - connection.lastLoginResponseSentAt < cooldownMs
            ) {
                this.logLoginDebug(
                    `[Login6B] cooldown skip src=${source} user="${username}" ver=${clientVersion}`,
                );
                return null;
            }

            if (connection.loginPhase === LoginPhase.AUTHENTICATED) {
                this.logLoginDebug(
                    `[Login6B] already authenticated src=${source} user="${username}"`,
                );
                return null;
            }
            if (
                connection.loginPhase === LoginPhase.USER_SENT &&
                connection.pendingLoginAt &&
                now - connection.pendingLoginAt < cooldownMs
            ) {
                if (connection.pendingLoginUser && username !== connection.pendingLoginUser) {
                    this.logLoginDebug(
                        `[Login6B] pending mismatch user src=${source} user="${username}" pending="${connection.pendingLoginUser}"`,
                    );
                    return null;
                }
            }
            if (connection.loginPhase === LoginPhase.USER_SENT) {
                if (
                    connection.pendingLoginUser &&
                    username &&
                    username !== connection.pendingLoginUser
                ) {
                    this.logLoginDebug(
                        `[Login6B] pending user conflict src=${source} user="${username}" pending="${connection.pendingLoginUser}"`,
                    );
                    return null;
                }
            }
            if (
                connection.loginPhase === LoginPhase.USER_SENT &&
                connection.pendingLoginUser === username
            ) {
                if (!this.config.resendDuplicateLogin6D) {
                    this.logLoginDebug(
                        `[Login6B] duplicate pending -> skip resend 0x6D src=${source} user="${username}"`,
                    );
                    return null;
                }
                this.logLoginDebug(
                    `[Login6B] duplicate pending -> resend 0x6D src=${source} user="${username}"`,
                );
                const login = this.buildLoginRequestReturn(
                    LoginRequestReturnStatus.SUCCESS,
                    username,
                );
                if (login.length === 0) {
                    this.logLoginDebug(
                        `[Login6B] duplicate pending build 0x6D failed src=${source} user="${username}"`,
                    );
                    return null;
                }
                const wrapped = this.hooks.wrapReliable(login, connection);
                this.logLoginDebug(
                    `[Login6B] duplicate pending built 0x6D len=${login.length} wrapped=${wrapped.length} src=${source}`,
                );
                return wrapped;
            }

            // Store pending login info; wait for 0x6E auth before authenticating.
            connection.pendingLoginUser = username;
            connection.pendingLoginClientVersion = clientVersion;
            connection.pendingLoginAt = Date.now();
            connection.loginPhase = LoginPhase.USER_SENT;

            this.logLoginDebug(
                `[Login6B] build 0x6D src=${source} user="${username}" ver=${clientVersion}`,
            );
            const login = this.buildLoginRequestReturn(
                LoginRequestReturnStatus.SUCCESS,
                username,
            );
            if (login.length === 0) {
                this.logLoginDebug(`[Login6B] build 0x6D failed src=${source} user="${username}"`);
                return null;
            }
            const wrapped = this.hooks.wrapReliable(login, connection);
            this.logLoginDebug(
                `[Login6B] built 0x6D len=${login.length} wrapped=${wrapped.length} src=${source}`,
            );
            return wrapped;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logLoginDebug(`[Login6B] exception src=${source} err=${msg}`);
            return null;
        }
    }

    parseLoginTokenCheck(
        stream: RakBitStream,
        connection: Connection,
        source: string,
        dryRun: boolean,
    ): Buffer | null {
        try {
            const fromServer = stream.readBit() === 1;
            if (fromServer) {
                const success = stream.readBit() === 1;
                const username = this.readBoundedString(stream, 0x20);
                this.logLoginDebug(
                    `[Login70] recv server->client src=${source} success=${success} user="${username}"`,
                );
                return null;
            }
            const requestToken = this.readBoundedString(stream, 0x20);
            if (dryRun) {
                this.logLoginDebug(
                    `[Login70] dryRun skip src=${source} token="${requestToken}"`,
                );
                return null;
            }
            const username = connection.pendingLoginUser || connection.username || '';
            const response = this.buildLoginTokenCheckResponse(true, username);
            this.logLoginDebug(
                `[Login70] respond src=${source} token="${requestToken}" user="${username}"`,
            );
            return this.hooks.wrapReliable(response, connection);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logLoginDebug(`[Login70] exception src=${source} err=${msg}`);
            return null;
        }
    }

    // Build 0x6D LOGIN_REQUEST_RETURN payload (master -> client).
    buildLoginRequestReturn(status: LoginRequestReturnStatus, username: string): Buffer {
        const writer = new RakBitStream();
        if (this.config.loginResponseTimestamp) {
            this.logLoginDebug('[Login6D] loginResponseTimestamp ignored for ID_LOGIN_REQUEST_RETURN');
        }
        writer.writeByte(RakNetMessageId.ID_LOGIN_REQUEST_RETURN);
        writer.writeCompressed(status & 0xff, 1);
        writeCompressedString(writer, username ?? '', 2048);

        const payload = writer.data;

        // Validate 0x6D payload can round-trip decode locally before sending.
        try {
            const verify = new RakBitStream(payload);
            const packetId = verify.readByte();
            if (packetId !== RakNetMessageId.ID_LOGIN_REQUEST_RETURN) {
                console.log(`[Login6D] encode verify failed: bad id=0x${packetId.toString(16)}`);
                return Buffer.alloc(0);
            }
            const statusStream = verify.readCompressed(1);
            const statusDecoded = statusStream.readByte();
            const decodedUser = readCompressedString(verify, 2048);
            if (decodedUser !== (username ?? '')) {
                console.log(
                    `[Login6D] encode verify failed: status=${statusDecoded} expected="${username}" got="${decodedUser}"`,
                );
                return Buffer.alloc(0);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(`[Login6D] encode verify failed: ${msg}`);
            return Buffer.alloc(0);
        }

        if (this.config.loginDebug || this.config.verbose) {
            console.log(
                `[Login6D] build ok status=${status} user="${username}" len=${payload.length}`,
            );
        }
        return payload;
    }

    private buildLoginTokenCheckResponse(success: boolean, username: string): Buffer {
        const writer = new RakBitStream();
        writer.writeByte(RakNetMessageId.ID_LOGIN_TOKEN_CHECK);
        writer.writeBit(true); // fromServer
        writer.writeBit(Boolean(success));
        this.writeBoundedString(writer, username ?? '', 0x20);
        return writer.data;
    }

    private buildLoginReturn(options: {
        status: LoginReturnStatus;
        playerId: number;
        clientVersion: number;
        accountType?: number;
        field4?: boolean;
        field5?: boolean;
        isBanned?: boolean;
    }): Buffer {
        const writer = new RakBitStream();
        writer.writeByte(RakNetMessageId.ID_LOGIN_RETURN);
        writer.writeCompressed(options.status & 0xff, 1);
        writer.writeCompressed(options.playerId >>> 0, 4);
        if (options.playerId !== 0) {
            const accountType = options.accountType ?? 0;
            writer.writeCompressed(accountType & 0xff, 1);
            writer.writeBit(Boolean(options.field4));
            writer.writeBit(Boolean(options.field5));
            writer.writeCompressed(options.clientVersion & 0xffff, 2);
            const isBanned = Boolean(options.isBanned);
            writer.writeBit(isBanned);
            if (isBanned) {
                writeCompressedString(writer, '0', 2048);
                writeCompressedString(writer, '', 2048);
            }
            // worldIDs vector (count + ids)
            writer.writeCompressed(0, 1);
            // factionMOTD
            writeCompressedString(writer, '', 2048);
            this.writeApartment(writer);
            writer.writeCompressed(0, 1);
            writer.writeCompressed(0, 1);
        }
        return writer.data;
    }

    private writeApartment(writer: RakBitStream): void {
        // NOTE: EncodeString/DecodeString semantics are assumed to be RakNet StringCompressor here.
        writer.writeCompressed(0, 4); // id
        writer.writeCompressed(0, 1); // type
        writer.writeCompressed(0, 4); // ownerPlayerID
        writer.writeCompressed(0, 4); // ownerFactionID
        // allowedRanks vector
        writer.writeCompressed(0, 1);
        writer.writeBit(false); // isOpen
        writeCompressedString(writer, '', 2048); // ownerName
        writeCompressedString(writer, '', 2048); // entryCode
        // storage ItemList
        writer.writeCompressed(0, 2); // capacity
        writer.writeCompressed(0, 4); // field_14
        writer.writeCompressed(0, 4); // field_18
        writer.writeCompressed(0, 4); // field_1C
        writer.writeCompressed(0, 2); // itemCount
        writer.writeBit(false); // hasPublicInfo
        writer.writeCompressed(0, 4); // entryPrice
        writeCompressedString(writer, '', 2048); // publicName
        writeCompressedString(writer, '', 2048); // publicDescription
        // allowedFactions map
        writer.writeCompressed(0, 4);
        writer.writeBit(false); // isDefault
        writer.writeBit(false); // isFeatured
        writer.writeCompressed(0, 4); // occupancy
    }

    // Parse 0x6E (LOGIN auth packet) and mark the connection authenticated.
    // Read order mirrors Packet_ID_LOGIN (Docs/Packets/ID_LOGIN.md):
    //   - username (StringCompressor)
    //   - passwordHash (bounded string, 64 bytes)
    //   - fileCRCs[3] (compressed u32)
    //   - macAddress (StringCompressor)
    //   - driveModels[4] (bounded string, 64 bytes)
    //   - driveSerialNumbers[4] (bounded string, 32 bytes)
    //   - loginToken (bounded string, 64 bytes)
    //   - computerName (StringCompressor)
    //   - hasSteamTicket bit, if set: 0x400 compressed bytes + compressed u32 length
    parseLoginAuth(
        stream: RakBitStream,
        connection: Connection,
        source: string,
        dryRun: boolean,
    ): void {
        if (
            connection.loginPhase !== LoginPhase.USER_SENT &&
            !this.config.acceptLoginAuthWithoutUser
        ) {
            return;
        }

        let username = '';
        let computerName = '';
        let macAddress = '';
        let loginToken = '';
        let passwordHash = Buffer.alloc(0);
        const fileCRCs: number[] = [];
        const driveModels: string[] = [];
        const driveSerials: string[] = [];
        let hasSteamTicket = false;
        let steamTicketBytes = 0;
        let steamTicketLength = 0;

        try {
            username = readCompressedString(stream, 2048);
            passwordHash = this.readBoundedBytes(stream, 0x40);
            for (let i = 0; i < 3; i += 1) {
                fileCRCs.push(this.readCompressedUInt(stream, 4));
            }
            macAddress = readCompressedString(stream, 2048);
            for (let i = 0; i < 4; i += 1) {
                driveModels.push(this.readBoundedString(stream, 0x40));
                driveSerials.push(this.readBoundedString(stream, 0x20));
            }
            loginToken = this.readBoundedString(stream, 0x40);
            computerName = readCompressedString(stream, 2048);
            hasSteamTicket = stream.readBit() === 1;
            if (hasSteamTicket) {
                steamTicketBytes = 0x400;
                for (let i = 0; i < 0x400; i += 1) {
                    const comp = stream.readCompressed(1);
                    comp.readByte();
                }
                steamTicketLength = this.readCompressedUInt(stream, 4);
            }
        } catch {
            // Best-effort parse; still allow auth to continue.
        }

        if (!username && connection.pendingLoginUser) {
            username = connection.pendingLoginUser;
        }

        if (dryRun) {
            return;
        }

        // TODO(DB): validate 0x6E auth payload before accepting login / sending 0x73.
        if (!this.validateLoginAuthWithDb(connection, {
            username,
            computerName,
            macAddress,
            passwordHash,
            loginToken,
            fileCRCs,
            driveModels,
            driveSerials,
            hasSteamTicket,
            steamTicketLength,
        })) {
            this.logLoginDebug(
                `[Login6E] reject (db) src=${source} user="${username}"`,
            );
            return;
        }

        connection.loginAuthUsername = username;
        connection.loginAuthComputer = computerName;
        connection.loginAuthPasswordHash = passwordHash.toString('hex');
        connection.loginAuthMacAddress = macAddress;
        connection.loginAuthLoginToken = loginToken;
        connection.loginAuthFileCRCs = fileCRCs;
        connection.loginAuthSteamTicket = hasSteamTicket;
        connection.loginAuthSteamTicketLength = steamTicketLength;
        connection.loginAuthSteamTicketBytes = steamTicketBytes;

        connection.username = username;
        connection.authenticated = true;
        connection.loginPhase = LoginPhase.AUTHENTICATED;
        connection.pendingLoginUser = '';
        connection.pendingLoginClientVersion = 0;
        connection.pendingLoginAt = 0;

        if (this.config.loginDebug || this.config.verbose) {
            const hashPreview = passwordHash.length > 0 ? passwordHash.subarray(0, 8).toString('hex') : '';
            const crcNote = fileCRCs.length > 0 ? fileCRCs.map((v) => `0x${v.toString(16)}`).join(',') : 'none';
            const driveNote = driveModels.filter((v) => v.length > 0).length;
            const steamNote = hasSteamTicket ? ` steam=0x${steamTicketLength.toString(16)}` : '';
            console.log(
                `[Login6E] ${connection.key} user="${username}" hash=${hashPreview} mac="${macAddress}" token="${loginToken}" crcs=[${crcNote}] drives=${driveNote}${steamNote} src=${source}`,
            );
        }
    }

    // Placeholder for DB-backed auth validation.
    // Return false to reject 0x6E and block 0x73 emission.
    private validateLoginAuthWithDb(
        _connection: Connection,
        _auth: {
            username: string;
            computerName: string;
            macAddress: string;
            passwordHash: Buffer;
            loginToken: string;
            fileCRCs: number[];
            driveModels: string[];
            driveSerials: string[];
            hasSteamTicket: boolean;
            steamTicketLength: number;
        },
    ): boolean {
        // TODO(DB): query account/session store here.
        return true;
    }

    private parseWorldLogin(
        stream: RakBitStream,
        _connection: Connection,
        source: string,
        _dryRun: boolean,
    ): { worldId: number; worldInst: number; playerId: number; worldConst: number } | null {
        try {
            const worldId = this.readCompressedUInt(stream, 1) & 0xff;
            const worldInst = this.readCompressedUInt(stream, 1) & 0xff;
            const playerId = this.readCompressedUInt(stream, 4);
            const worldConst = this.readCompressedUInt(stream, 4);
            return { worldId, worldInst, playerId, worldConst };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logLoginDebug(`[Login72] parse failed src=${source} err=${msg}`);
            return null;
        }
    }

    private buildWorldSelect(playerId: number, worldId: number, worldInst: number): Buffer {
        const writer = new RakBitStream();
        writer.writeByte(RakNetMessageId.ID_WORLD_SELECT);
        writer.writeCompressed(playerId >>> 0, 4);
        writer.writeCompressed(4, 1);
        writer.writeCompressed(worldId & 0xff, 1);
        writer.writeCompressed(worldInst & 0xff, 1);
        return writer.data;
    }

    // Build 0x73 WORLD_LOGIN_RETURN (master/world -> client).
    // Layout: id + code(u8c) + flag(u8c) + ip(u32c, BE->LE) + port(u16c)
    private buildWorldLoginReturn(
        success: boolean,
        worldIp: string,
        worldPort: number,
        options?: { code?: number; flag?: number },
    ): Buffer {
        const writer = new RakBitStream();
        writer.writeByte(RakNetMessageId.ID_WORLD_LOGIN_RETURN);
        const code = options?.code ?? (success ? 1 : 0);
        const flag = options?.flag ?? 0;
        writer.writeCompressed(code & 0xff, 1);
        writer.writeCompressed(flag & 0xff, 1);
        const ipU32 = this.ipv4ToU32BE(worldIp);
        writer.writeCompressed(ipU32 >>> 0, 4);
        writer.writeCompressed(worldPort & 0xffff, 2);
        return writer.data;
    }
}
