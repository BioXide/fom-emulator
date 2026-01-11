/**
 * FoM Server Emulator V2
 *
 * Uses native RakNet 3.611 via Bun FFI for proper reliability, ACKs, and duplicate detection.
 *
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
import { RakNetMessageId } from '@openfom/packets';

import { configureLogger, debug as logDebug, error as logError, info as logInfo, warn as logWarn } from '@openfom/utils';
import { loadRuntimeConfig } from './config';
import { ConnectionManager } from './network/Connection';
import { LoginHandler } from './handlers/LoginHandler';
import { createPacketHandlers } from './handlers/registerHandlers';
import { loadRsaKeyFromJson, type RsaKeyJson } from './utils/Rsa';
import rsaKeyJson from './fom_private_key.json' with { type: 'json' };

const runtime = loadRuntimeConfig();
const config = runtime.server;
const packetLogConfig = runtime.packetLog;

const {
    quiet,
    consoleMode,
    consoleMinIntervalMs,
    logToFile,
    analysisEnabled,
    consolePacketIds,
    filePacketIds,
    ignorePacketIds,
    consoleRepeatSuppressMs,
    flushMode,
} = packetLogConfig;

configureLogger({ quiet, debug: config.debug || config.loginDebug });

PacketLogger.installConsoleMirror({ echoToConsole: !quiet });

const packetLogger = new PacketLogger({
    console: !quiet && consoleMode !== 'off',
    file: logToFile,
    consoleMode,
    consoleMinIntervalMs,
    consolePacketIds,
    filePacketIds,
    ignorePacketIds,
    analysis: analysisEnabled,
    consoleRepeatSuppressMs,
    flushMode,
    assumePayload: true,
});

PacketLogger.setGlobal(packetLogger);
PacketLogger.setConsoleMirrorEcho(!quiet);

// =============================================================================
// Server Setup
// =============================================================================

// =============================================================================
// Load RSA Keys
// =============================================================================

const rsaKey = loadRsaKeyFromJson(rsaKeyJson as RsaKeyJson);
if (rsaKey) {
    logInfo(`[RSA] Loaded private key: ${rsaKey.modulusBytes} bytes, ${rsaKey.endian} endian`);
} else {
    logWarn('[RSA] Failed to load private key - login decryption will fail');
}

logInfo('='.repeat(60));
logInfo(' FoM Server Emulator V2 - Native RakNet');
logInfo('='.repeat(60));
logInfo(`  Mode: ${config.serverMode}`);
logInfo(`  Port: ${config.port}`);
logInfo(`  Max Connections: ${config.maxConnections}`);
logInfo(`  RSA Key: ${rsaKey ? 'loaded' : 'NOT LOADED'}`);
logInfo(`  Debug: ${config.debug}`);
logInfo(`  LoginStrict: ${config.loginStrict}`);
logInfo(`  LoginClientVersion: ${config.loginClientVersion}`);
logInfo('='.repeat(60));
logInfo('');

// Create components
const peer = new RakPeer();
const connections = new ConnectionManager();
const loginHandler = new LoginHandler({
    serverMode: config.serverMode,
    worldIp: config.worldIp,
    worldPort: config.worldPort,
    debug: config.debug,
    loginDebug: config.loginDebug,
    loginStrict: config.loginStrict,
    loginRequireCredentials: config.loginRequireCredentials,
    acceptLoginAuthWithoutUser: config.acceptLoginAuthWithoutUser,
    resendDuplicateLogin6D: config.resendDuplicateLogin6D,
    loginClientVersion: config.loginClientVersion,
    loginResetDelayMs: config.loginResetDelayMs,
    worldSelectWorldId: config.worldSelectWorldId,
    worldSelectWorldInst: config.worldSelectWorldInst,
    worldSelectPlayerId: config.worldSelectPlayerId,
    worldSelectPlayerIdRandom: config.worldSelectPlayerIdRandom,
});

// Start the server
if (!peer.startup(config.maxConnections, config.port, 0)) {
    logError('[Server] Failed to start RakNet peer');
    process.exit(1);
}

peer.setMaxIncomingConnections(config.maxConnections);
peer.setIncomingPassword(config.password);

logInfo(`[Server] Listening on port ${config.port}`);
logInfo('');

// =============================================================================
// Send Helper
// =============================================================================

function sendReliable(data: Buffer, address: RakSystemAddress): boolean {
    // Log outbound packet before send to keep file log complete.
    const addrIp = addressToIp(address);
    const connection = connections.get(address);
    const outgoingPacket = {
        timestamp: new Date(),
        direction: PacketDirection.OUTGOING,
        address: addrIp,
        port: address.port,
        data,
        connectionId: connection?.id,
    };
    try {
        const logged = packetLogger.log(outgoingPacket);
        packetLogger.logAnalysis(outgoingPacket, logged);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        PacketLogger.globalNote(
            `[Error] packetLog SEND addr=${addrIp}:${address.port} len=${data.length} err=${msg}`,
        );
    }

    const success = peer.send(
        data,
        RakPriority.HIGH,
        RakReliability.RELIABLE,  // Changed from RELIABLE_ORDERED - FoM expects RELIABLE
        0, // ordering channel
        address,
        false, // not broadcast
    );
    if (config.debug) {
        const addr = addressToString(address);
        const msgId = data[0];
        logDebug(
            `[Server] SEND 0x${msgId.toString(16).padStart(2, '0')} to ${addr} (${data.length} bytes) - ${success ? 'OK' : 'FAIL'}`,
        );
    }
    return success;
}

function sendUnreliable(data: Buffer, address: RakSystemAddress): boolean {
    // Log outbound packet before send to keep file log complete.
    const addrIp = addressToIp(address);
    const connection = connections.get(address);
    const outgoingPacket = {
        timestamp: new Date(),
        direction: PacketDirection.OUTGOING,
        address: addrIp,
        port: address.port,
        data,
        connectionId: connection?.id,
    };
    try {
        const logged = packetLogger.log(outgoingPacket);
        packetLogger.logAnalysis(outgoingPacket, logged);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        PacketLogger.globalNote(
            `[Error] packetLog SEND addr=${addrIp}:${address.port} len=${data.length} err=${msg}`,
        );
    }

    const success = peer.send(
        data,
        RakPriority.LOW,
        RakReliability.UNRELIABLE,
        0,
        address,
        false,
    );
    if (config.debug) {
        const addr = addressToString(address);
        const msgId = data[0];
        logDebug(
            `[Server] SEND (UNREL) 0x${msgId.toString(16).padStart(2, '0')} to ${addr} (${data.length} bytes) - ${success ? 'OK' : 'FAIL'}`,
        );
    }
    return success;
}

// =============================================================================
// Packet Handlers
// =============================================================================

const handlers = createPacketHandlers({
    connections,
    loginHandler,
    sendReliable,
});

// =============================================================================
// Packet Unwrap Helpers (RakNet timestamp/user packet)
// =============================================================================

function hexDump(buffer: Buffer, maxBytes = 64): { hex: string; truncated: boolean } {
    const truncated = buffer.length > maxBytes;
    const view = truncated ? buffer.subarray(0, maxBytes) : buffer;
    const hex = Array.from(view)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
    return { hex, truncated };
}

function unwrapPacketPayload(data: Buffer): {
    outerId: number;
    innerId: number | null;
    innerPacket: Buffer | null;
    lithId: number | null;
    lithPayload: Buffer | null;
} {
    const outerId = data[0] ?? 0;
    let innerId: number | null = null;
    let innerPacket: Buffer | null = null;
    let lithId: number | null = null;
    let lithPayload: Buffer | null = null;

    if (outerId === RakNetMessageId.ID_TIMESTAMP) {
        if (data.length >= 6) {
            // RakNetTime is 32-bit unless __GET_TIME_64BIT is enabled.
            innerPacket = data.subarray(5);
            innerId = innerPacket[0] ?? null;
        }
    } else {
        innerPacket = data;
        innerId = outerId;
    }

    if (innerId === RakNetMessageId.ID_USER_PACKET_ENUM && innerPacket && innerPacket.length >= 2) {
        lithId = innerPacket[1];
        lithPayload = innerPacket.subarray(2);
    }

    return { outerId, innerId, innerPacket, lithId, lithPayload };
}

// =============================================================================
// Main Loop
// =============================================================================

async function mainLoop() {
    logInfo('[Server] Starting main loop...');
    logInfo('');

    while (peer.isActive()) {
        // Process all pending packets
        let packet = peer.receive();
        while (packet) {
            // Log inbound packet before dispatch.
            const addrIp = addressToIp(packet.systemAddress);
            const connection = connections.get(packet.systemAddress);
            const incomingPacket = {
                timestamp: new Date(),
                direction: PacketDirection.INCOMING,
                address: addrIp,
                port: packet.systemAddress.port,
                data: Buffer.from(packet.data),
                connectionId: connection?.id,
            };
            try {
                const logged = packetLogger.log(incomingPacket);
                packetLogger.logAnalysis(incomingPacket, logged);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                PacketLogger.globalNote(
                    `[Error] packetLog RECV addr=${addrIp}:${packet.systemAddress.port} len=${packet.length} err=${msg}`,
                );
            }

            const messageId = packet.data[0];
            const handler = handlers.get(messageId);

            if (handler) {
                try {
                    handler(packet);
                } catch (err) {
                    const addr = addressToString(packet.systemAddress);
                    const errText = err instanceof Error ? err.stack || err.message : String(err);
                    logError(
                        `[Server] Error handling packet 0x${messageId.toString(16)} from ${addr}: ${errText}`,
                    );
                }
            } else {
                // Log unknown packets
                if (config.debug || messageId >= 0x50) {  // Log game packets
                    const addr = addressToString(packet.systemAddress);
                    const unwrap = unwrapPacketPayload(packet.data);
                    logInfo(
                        `[Server] Unhandled 0x${messageId.toString(16).padStart(2, '0')} from ${addr} (${packet.length} bytes)`,
                    );
                    if (unwrap.innerPacket && unwrap.outerId === RakNetMessageId.ID_TIMESTAMP) {
                        logInfo(
                            `[Server] -> ID_TIMESTAMP innerId=0x${(unwrap.innerId ?? 0).toString(16).padStart(2, '0')} innerLen=${unwrap.innerPacket.length}`,
                        );
                    }
                    if (unwrap.lithId !== null && unwrap.lithPayload) {
                        logInfo(
                            `[Server] -> USER_PACKET lithId=0x${unwrap.lithId.toString(16).padStart(2, '0')} lithLen=${unwrap.lithPayload.length}`,
                        );
                    }
                    const dumpTarget = unwrap.lithPayload ?? unwrap.innerPacket ?? packet.data;
                    const { hex, truncated } = hexDump(dumpTarget, 96);
                    logInfo(`         ${hex}${truncated ? ' ...' : ''}`);
                }
            }

            // Get next packet
            packet = peer.receive();
        }

        // Small sleep to prevent busy-waiting
        await Bun.sleep(10);
    }

    logInfo('\n[Server] Main loop has exited.');
}

// =============================================================================
// Graceful Shutdown
// =============================================================================

function shutdown() {
    logInfo('\n[Server] Shutting down...');
    peer.shutdown(500);
    peer.destroy();
    logInfo('[Server] Goodbye!');
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
    const errText = err instanceof Error ? err.stack || err.message : String(err);
    logError(`[Server] Uncaught exception: ${errText}`);
    shutdown();
});
process.on('unhandledRejection', (reason) => {
    const reasonText = reason instanceof Error ? reason.stack || reason.message : String(reason);
    logError(`[Server] Unhandled rejection: ${reasonText}`);
    shutdown();
});
process.on('beforeExit', (code) => {
    logInfo(`[Server] Process beforeExit event with code: ${code}`);
});

// =============================================================================
// Start
// =============================================================================

mainLoop().catch((err) => {
    const errText = err instanceof Error ? err.stack || err.message : String(err);
    logError(`[Server] Fatal error in main loop: ${errText}`);
    peer.shutdown(0);
    peer.destroy();
    process.exit(1);
});

