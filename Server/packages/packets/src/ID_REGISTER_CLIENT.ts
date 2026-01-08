/**
 * ID_REGISTER_CLIENT (0x78) - Client -> World Server
 *
 * Sent by the client after receiving the LithTech burst (SMSG_NETPROTOCOLVERSION,
 * SMSG_YOURID, SMSG_CLIENTOBJECTID, SMSG_LOADWORLD) to register on the world server.
 *
 * The server should respond with ID_REGISTER_CLIENT_RETURN (0x79).
 *
 * Wire format (bitstream):
 *   u8   packetId (0x78)
 *   u8c  worldId (compressed)
 *   u32c playerId (compressed) - from SharedMem slot 0x5B
 *   u32c sessionId (compressed) - from SharedMem slot 6
 *
 * Source: Object.lto @ 0x100782b0 (Packet_ID_REGISTER_CLIENT_Ctor)
 *         Object.lto @ 0x10078d20 (Packet_Write_U8_U32_U32)
 *         Object.lto @ 0x10079580 (RegisterClientOnWorld)
 */

import { NativeBitStream } from '@openfom/networking';
import { RakNetMessageId } from './shared';
import { Packet } from './base';

export interface IdRegisterClientData {
    worldId: number;
    playerId: number;
    sessionId: number;
}

export class IdRegisterClientPacket extends Packet {
    static RAKNET_ID = RakNetMessageId.ID_REGISTER_CLIENT;

    worldId: number;
    playerId: number;
    sessionId: number;

    constructor(data: IdRegisterClientData) {
        super();
        this.worldId = data.worldId;
        this.playerId = data.playerId;
        this.sessionId = data.sessionId;
    }

    encode(): Buffer {
        throw new Error('IdRegisterClientPacket is client->server only');
    }

    /**
     * Wire: u8 msgId, u8c worldId, u32c playerId, u32c sessionId
     */
    static decode(buffer: Buffer): IdRegisterClientPacket {
        const bs = new NativeBitStream(buffer, true);
        try {
            const packetId = bs.readU8();
            if (packetId !== RakNetMessageId.ID_REGISTER_CLIENT) {
                throw new Error(`Expected packet ID 0x78, got 0x${packetId.toString(16)}`);
            }

            const worldId = bs.readCompressedU8();
            const playerId = bs.readCompressedU32();
            const sessionId = bs.readCompressedU32();

            return new IdRegisterClientPacket({ worldId, playerId, sessionId });
        } finally {
            bs.destroy();
        }
    }

    toString(): string {
        return `IdRegisterClientPacket { worldId: ${this.worldId}, playerId: ${this.playerId}, sessionId: ${this.sessionId} }`;
    }
}
