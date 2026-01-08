/**
 * FoM World Server
 *
 * Handles in-world gameplay after players connect from the Master server.
 * Listens on port 62000 (default) for ID_WORLD_LOGIN (0x72) from clients
 * redirected by the master server.
 */

import {
    RakPeer,
    RakReliability,
    RakPriority,
    type RakSystemAddress,
    addressToIp,
    addressToString,
    PacketLogger,
    PacketDirection,
} from '@openfom/networking';
import {
    RakNetMessageId,
    IdWorldLoginPacket,
    IdRegisterClientPacket,
    IdRegisterClientReturnPacket,
    IdWorldSelectPacket,
    IdWorldServicePacket,
    WorldSelectSubId,
    LtGuaranteedPacket,
    MsgUnguaranteedUpdate,
    IdUserPacket,
} from '@openfom/packets';
import { configureLogger, debug as logDebug, error as logError, info as logInfo } from '@openfom/utils';
import { loadRuntimeConfig } from './config';

const runtime = loadRuntimeConfig();
const config = runtime.server;
const packetLogConfig = runtime.packetLog;

configureLogger({ quiet: packetLogConfig.quiet, debug: config.debug });

PacketLogger.installConsoleMirror({ echoToConsole: !packetLogConfig.quiet });

const packetLogger = new PacketLogger({
    console: !packetLogConfig.quiet && packetLogConfig.consoleMode !== 'off',
    file: packetLogConfig.logToFile,
    consoleMode: packetLogConfig.consoleMode,
    consoleMinIntervalMs: packetLogConfig.consoleMinIntervalMs,
    consolePacketIds: packetLogConfig.consolePacketIds,
    filePacketIds: packetLogConfig.filePacketIds,
    ignorePacketIds: packetLogConfig.ignorePacketIds,
    analysis: packetLogConfig.analysisEnabled,
    consoleRepeatSuppressMs: packetLogConfig.consoleRepeatSuppressMs,
    flushMode: packetLogConfig.flushMode,
    assumePayload: true,
});

PacketLogger.setGlobal(packetLogger);
PacketLogger.setConsoleMirrorEcho(!packetLogConfig.quiet);

logInfo('='.repeat(60));
logInfo(' FoM World Server');
logInfo('='.repeat(60));
logInfo(`  Port: ${config.port}`);
logInfo(`  Max Connections: ${config.maxConnections}`);
logInfo(`  Debug: ${config.debug}`);
logInfo('='.repeat(60));
logInfo('');

interface WorldConnection {
    address: RakSystemAddress;
    key: string;
    playerId: number;
    worldId: number;
    worldInst: number;
    authenticated: boolean;
    registered: boolean;
    worldTimeOrigin: number;
    lastHeartbeatAt: number;
    lithTechOutSeq: number;
}

const connections = new Map<string, WorldConnection>();

function getConnectionKey(address: RakSystemAddress): string {
    return `${addressToIp(address)}:${address.port}`;
}

const peer = new RakPeer();

if (!peer.startup(config.maxConnections, config.port, 0)) {
    logError('[World] Failed to start RakNet peer');
    process.exit(1);
}

peer.setMaxIncomingConnections(config.maxConnections);
peer.setIncomingPassword(config.password);

logInfo(`[World] Listening on port ${config.port}`);
logInfo('');

function sendReliable(data: Buffer, address: RakSystemAddress): boolean {
    const addrIp = addressToIp(address);
    const connection = connections.get(getConnectionKey(address));
    const outgoingPacket = {
        timestamp: new Date(),
        direction: PacketDirection.OUTGOING,
        address: addrIp,
        port: address.port,
        data,
        connectionId: connection?.playerId,
    };
    try {
        packetLogger.log(outgoingPacket);
    } catch {}

    const success = peer.send(
        data,
        RakPriority.HIGH,
        RakReliability.RELIABLE_ORDERED,
        0,
        address,
        false,
    );
    if (config.debug) {
        const addr = addressToString(address);
        const msgId = data[0];
        logDebug(`[World] SEND 0x${msgId.toString(16).padStart(2, '0')} to ${addr} (${data.length} bytes) - ${success ? 'OK' : 'FAIL'}`);
    }
    return success;
}

function sendUnreliable(data: Buffer, address: RakSystemAddress): boolean {
    const success = peer.send(
        data,
        RakPriority.LOW,
        RakReliability.UNRELIABLE,
        0,
        address,
        false,
    );
    return success;
}

function sendLithTechBurst(conn: WorldConnection): void {
    const seq = conn.lithTechOutSeq;
    conn.lithTechOutSeq = (seq + 1) & 0x1fff;

    const lithBurst = LtGuaranteedPacket.buildWorldLoginBurst(seq, conn.playerId, conn.playerId, conn.worldId);
    const wrappedBurst = IdUserPacket.wrap(lithBurst).encode();
    sendReliable(wrappedBurst, conn.address);
    logInfo(`[World] -> LithTech burst (worldId=${conn.worldId}, playerId=${conn.playerId}, ${wrappedBurst.length - 1} bytes)`);
}

function handleWorldLogin(packet: IdWorldLoginPacket, address: RakSystemAddress): void {
    const { worldId, worldInst, playerId, worldConst } = packet;
    const key = getConnectionKey(address);

    logInfo(`[World] 0x72 WORLD_LOGIN from ${key}: worldId=${worldId} inst=${worldInst} playerId=${playerId} const=0x${worldConst.toString(16)}`);

    const conn = connections.get(key);
    if (!conn) {
        logError(`[World] No connection found for ${key}`);
        return;
    }

    conn.playerId = playerId || 1;
    conn.worldId = worldId || 1;
    conn.worldInst = worldInst || 0;
    conn.authenticated = true;

    logInfo(`[World] Updated connection: playerId=${conn.playerId} worldId=${conn.worldId}`);
}

function handleRegisterClient(packet: IdRegisterClientPacket, address: RakSystemAddress): void {
    const { worldId, playerId, sessionId } = packet;
    const key = getConnectionKey(address);

    logInfo(`[World] 0x78 REGISTER_CLIENT from ${key}: worldId=${worldId} playerId=${playerId} sessionId=${sessionId}`);

    const conn = connections.get(key);
    if (!conn) {
        logError(`[World] No connection found for ${key}`);
        return;
    }

    // if (!conn.authenticated) {
        logError(`[World] Connection ${key} not authenticated (missing 0x6b), seding REGISTER_CLIENT anyway`);
        // return;
    // }
    conn.authenticated = true;

    conn.playerId = playerId || conn.playerId;
    conn.worldId = worldId || conn.worldId;
    conn.registered = true;

    const response = new IdRegisterClientReturnPacket({
        worldId: conn.worldId,
        playerId: conn.playerId,
        flags: 0,
    });
    
    const responseBuffer = response.encode();
    sendReliable(responseBuffer, address);
    logInfo(`[World] -> 0x79 REGISTER_CLIENT_RETURN (worldId=${conn.worldId}, playerId=${conn.playerId}, ${responseBuffer.length} bytes)`);

    // Send 0x7B WORLD_SELECT after 0x79 (observed in pcap)
    const worldSelect = new IdWorldSelectPacket({
        playerId: conn.playerId,
        subId: WorldSelectSubId.WORLD_ID_INST,
        worldId: conn.worldId,
        worldInst: conn.worldInst,
    });
    const worldSelectBuffer = worldSelect.encode();
    sendReliable(worldSelectBuffer, address);
    logInfo(`[World] -> 0x7B WORLD_SELECT (worldId=${conn.worldId}, worldInst=${conn.worldInst}, ${worldSelectBuffer.length} bytes)`);

    // sendLithTechBurst(conn);
}

function handleNewConnection(address: RakSystemAddress): void {
    const key = getConnectionKey(address);
    logInfo(`[World] New connection from ${key}`);

    const conn: WorldConnection = {
        address,
        key,
        playerId: 1,
        worldId: 1,
        worldInst: 0,
        authenticated: false,
        registered: false,
        worldTimeOrigin: Date.now(),
        lastHeartbeatAt: 0,
        lithTechOutSeq: 0,
    };
    connections.set(key, conn);

    const timestamp = new MsgUnguaranteedUpdate({
        objectId: 1235,
        gameTime: 1234,
    });
    const wrapped = IdUserPacket.wrap(timestamp).encode();
    sendReliable(wrapped, address);
    sendLithTechBurst(conn);
}

function handleWorldAuth(data: Buffer, address: RakSystemAddress): void {
    const key = getConnectionKey(address);
    const conn = connections.get(key);
    if (!conn) {
        logError(`[World] No connection found for ${key}`);
        return;
    }

    logInfo(`[World] 0x6b WORLD_AUTH from ${key} (${data.length} bytes) - marking authenticated`);
    conn.authenticated = true;
}

function handleDisconnect(address: RakSystemAddress): void {
    const key = getConnectionKey(address);
    logInfo(`[World] Disconnected: ${key}`);
    connections.delete(key);
}

async function mainLoop() {
    logInfo('[World] Starting main loop...');
    logInfo('');

    while (peer.isActive()) {
        let packet = peer.receive();
        while (packet) {
            console.log('received packet');
            const addrIp = addressToIp(packet.systemAddress);
            const connection = connections.get(getConnectionKey(packet.systemAddress));
            const incomingPacket = {
                timestamp: new Date(),
                direction: PacketDirection.INCOMING,
                address: addrIp,
                port: packet.systemAddress.port,
                data: Buffer.from(packet.data),
                connectionId: connection?.playerId,
            };
            try {
                packetLogger.log(incomingPacket);
            } catch {}

            const messageId = packet.data[0];

            switch (messageId) {
                case RakNetMessageId.ID_NEW_INCOMING_CONNECTION:
                    handleNewConnection(packet.systemAddress);
                    break;

                case RakNetMessageId.ID_DISCONNECTION_NOTIFICATION:
                case RakNetMessageId.ID_CONNECTION_LOST:
                    handleDisconnect(packet.systemAddress);
                    break;

                case RakNetMessageId.ID_WORLD_LOGIN: {
                    const worldLoginPacket = IdWorldLoginPacket.decode(Buffer.from(packet.data));
                    handleWorldLogin(worldLoginPacket, packet.systemAddress);
                    break;
                }

                case 0x6b: {
                    handleWorldAuth(Buffer.from(packet.data), packet.systemAddress);
                    break;
                }

                case RakNetMessageId.ID_WORLDSERVICE: {
                    const worldServicePacket = IdWorldServicePacket.decode(Buffer.from(packet.data));
                    const key = getConnectionKey(packet.systemAddress);
                    logInfo(`[World] 0xa5 WORLDSERVICE from ${key}: ${worldServicePacket.toString()}`);
                    break;
                }

                case RakNetMessageId.ID_REGISTER_CLIENT: {
                    const registerPacket = IdRegisterClientPacket.decode(Buffer.from(packet.data));
                    handleRegisterClient(registerPacket, packet.systemAddress);
                    break;
                }

                default:
                    if (config.debug || messageId >= 0x50) {
                        const addr = addressToString(packet.systemAddress);
                        logInfo(`[World] Unhandled 0x${messageId.toString(16).padStart(2, '0')} from ${addr} (${packet.length} bytes)`);
                        if (packet.length <= 32) {
                            const hex = Array.from(packet.data)
                                .map((b) => b.toString(16).padStart(2, '0'))
                                .join(' ');
                            logInfo(`         ${hex}`);
                        }
                    }
                    break;
            }

            packet = peer.receive();
        }

        const now = Date.now();
        const heartbeatMs = 3000;
        for (const conn of connections.values()) {
            if (!conn.authenticated) continue;
            if (conn.lastHeartbeatAt && (now - conn.lastHeartbeatAt) < heartbeatMs) continue;
            conn.lastHeartbeatAt = now;

            const elapsedSec = (now - conn.worldTimeOrigin) / 1000;
            const updateMsg = MsgUnguaranteedUpdate.createHeartbeat(elapsedSec);

            const seq = conn.lithTechOutSeq;
            conn.lithTechOutSeq = (seq + 1) & 0x1fff;
            const lithPacket = LtGuaranteedPacket.fromMessages(seq, [updateMsg]);
            const wrapped = IdUserPacket.wrap(lithPacket).encode();
            sendUnreliable(wrapped, conn.address);
        }

        await Bun.sleep(10);
    }
}

function shutdown() {
    logInfo('\n[World] Shutting down...');
    peer.shutdown(500);
    peer.destroy();
    logInfo('[World] Goodbye!');
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

mainLoop().catch((err) => {
    const errText = err instanceof Error ? err.stack || err.message : String(err);
    logError(`[World] Fatal error in main loop: ${errText}`);
    peer.shutdown(0);
    peer.destroy();
    process.exit(1);
});
