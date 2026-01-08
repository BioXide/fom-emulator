/**
 * ID_REGISTER_CLIENT_RETURN (0x79) - World Server -> Client
 *
 * Response to ID_REGISTER_CLIENT (0x78). Contains the player's world login data
 * including profile blocks, inventory, stats, and other session data.
 *
 * This is a complex packet with many sub-structures. For initial implementation,
 * we provide minimal required fields to allow client progression.
 *
 * Wire format (bitstream) - simplified:
 *   u8   packetId (0x79)
 *   u8c  worldId
 *   u32c unkValue1
 *   u8c  unkValue2
 *   ...  ProfileA block
 *   ...  ProfileB block
 *   ...  ProfileC block
 *   ...  ProfileD block
 *   ...  StringBundleE block
 *   ...  Additional profile data
 *
 * Source: Object.lto @ 0x1007a850 (Packet_ID_WORLD_LOGIN_DATA_Ctor)
 *         Object.lto @ 0x1007ab00 (ID_WORLD_LOGIN_DATA_Write)
 */

import { NativeBitStream } from '@openfom/networking';
import { RakNetMessageId } from './shared';
import { Packet } from './base';

export interface IdRegisterClientReturnData {
    worldId: number;
    playerId: number;
    flags: number;
}

export class IdRegisterClientReturnPacket extends Packet {
    static RAKNET_ID = RakNetMessageId.ID_REGISTER_CLIENT_RETURN;

    worldId: number;
    playerId: number;
    flags: number;

    constructor(data: IdRegisterClientReturnData) {
        super();
        this.worldId = data.worldId;
        this.playerId = data.playerId;
        this.flags = data.flags;
    }

    encode(): Buffer {
        const bs = new NativeBitStream();
        try {
            bs.writeU8(RakNetMessageId.ID_REGISTER_CLIENT_RETURN);
            
            bs.writeCompressedU8(this.worldId);
            bs.writeCompressedU32(this.playerId);
            bs.writeCompressedU8(this.flags);
            
            // ProfileA block - minimal empty init
            this.writeEmptyProfileA(bs);
            
            // ProfileB block - minimal empty init
            this.writeEmptyProfileB(bs);
            
            // ProfileC block - minimal empty init
            this.writeEmptyProfileC(bs);
            
            // ProfileD block - minimal empty init
            this.writeEmptyProfileD(bs);
            
            // StringBundleE block - minimal empty init
            this.writeEmptyStringBundleE(bs);
            
            // Additional fields from ID_WORLD_LOGIN_DATA_Write
            bs.writeCompressedU8(3);  // offset 0xF28 - some flag
            bs.writeCompressedU8(0);  // offset 0xF29 - some flag
            bs.writeCompressedU16(0); // offset 0xF2A - array count
            
            // No array entries since count = 0
            
            bs.writeBit(false);       // offset 0x49C4 - flag
            this.writeEmptyVec3Block(bs); // offset 0x49C8
            
            bs.writeCompressedU32(0); // offset 0x49D8 - timestamp or id
            bs.writeCompressedU32(0); // offset 0x49DC - timestamp or id
            
            bs.writeBit(false);       // offset 0x49E0 - flag
            bs.writeCompressedU16(0); // offset 0x49E2 - some id
            
            this.writeEmptyEntryGBlock(bs); // offset 0x49E4
            
            // WriteBlob2048 - empty blob (vtbl+52 call)
            this.writeEmptyBlob2048(bs);
            
            this.writeEmptyBlock0C9C(bs); // offset 0xC9C
            this.writeEmptyVec3Block(bs); // offset 0x4A80
            
            bs.writeBit(false);       // offset 0x4A90 - flag
            this.writeEmptyBlock4A94(bs); // offset 0x4A94
            
            return bs.getData();
        } finally {
            bs.destroy();
        }
    }

    private writeEmptyProfileA(bs: NativeBitStream): void {
        // ProfileA has ~1000 bytes of data, write minimal zeros
        // Based on WorldLogin_ProfileA_Init pattern
        for (let i = 0; i < 270; i++) {
            bs.writeCompressedU32(0);
        }
    }

    private writeEmptyProfileB(bs: NativeBitStream): void {
        // ProfileB is smaller, write minimal structure
        for (let i = 0; i < 16; i++) {
            bs.writeCompressedU16(0);
        }
    }

    private writeEmptyProfileC(bs: NativeBitStream): void {
        // ProfileC - write count then entries
        bs.writeCompressedU16(0); // count = 0
    }

    private writeEmptyProfileD(bs: NativeBitStream): void {
        // ProfileD - empty structure
        bs.writeCompressedU32(0);
    }

    private writeEmptyStringBundleE(bs: NativeBitStream): void {
        // StringBundleE - typically huffman-encoded strings
        bs.writeCompressedU16(0); // string count = 0
    }

    private writeEmptyVec3Block(bs: NativeBitStream): void {
        // CompactVec3 - 3 compressed floats
        bs.writeCompressedU16(0); // x
        bs.writeCompressedU16(0); // y
        bs.writeCompressedU16(0); // z
    }

    private writeEmptyEntryGBlock(bs: NativeBitStream): void {
        // EntryGBlock - appearance/equipment data
        bs.writeCompressedU8(0);  // entry count
    }

    private writeEmptyBlob2048(bs: NativeBitStream): void {
        // Blob with max 2048 bits - write length then data
        bs.writeCompressedU16(0); // blob length = 0
    }

    private writeEmptyBlock0C9C(bs: NativeBitStream): void {
        // Unknown block at offset 0xC9C
        bs.writeCompressedU16(0);
    }

    private writeEmptyBlock4A94(bs: NativeBitStream): void {
        // Unknown block at offset 0x4A94
        bs.writeCompressedU32(0);
    }

    static decode(buffer: Buffer): IdRegisterClientReturnPacket {
        throw new Error('IdRegisterClientReturnPacket decode not implemented - server->client only');
    }

    toString(): string {
        return `IdRegisterClientReturnPacket { worldId: ${this.worldId}, playerId: ${this.playerId}, flags: ${this.flags} }`;
    }
}
