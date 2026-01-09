/**
 * ID_REGISTER_CLIENT_RETURN (0x79) - World Server -> Client
 *
 * Response to ID_REGISTER_CLIENT (0x78). Contains the player's world login data
 * including profile blocks, inventory, stats, and other session data.
 *
 * This is a complex packet with many sub-structures. Implementation follows
 * the exact bit-level format from object.lto analysis.
 *
 * Source: Object.lto @ 0x1007a850 (Packet_ID_WORLD_LOGIN_DATA_Ctor)
 *         Object.lto @ 0x1007ab00 (ID_WORLD_LOGIN_DATA_Write)
 * 
 * See: Docs/Notes/ID_REGISTER_CLIENT_RETURN_0x79.md for full structure
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
            // Header
            bs.writeU8(RakNetMessageId.ID_REGISTER_CLIENT_RETURN); // 0x79
            bs.writeCompressedU8(this.worldId);   // offset 0x430 (1072)
            bs.writeCompressedU32(this.playerId); // offset 0x434 (1076)
            bs.writeCompressedU8(this.flags);     // offset 0x438 (1080)
            
            // ProfileA block - sub_100EAAF0 (offset 0x43C / 1084)
            this.writeProfileA(bs);
            
            // ProfileB block - WorldLogin_WriteProfileBlockB (offset 0x878 / 2168)
            this.writeProfileB(bs);
            
            // ProfileC block - WorldLogin_WriteProfileBlockC (offset 0x8B8 / 2232)
            this.writeProfileC(bs);
            
            // ProfileD block - WorldLogin_WriteProfileBlockD (offset 0x8EC / 2284)
            this.writeProfileD(bs);
            
            // StringBundleE block - WorldLogin_WriteStringBundleE (offset 0xCCC / 3276)
            this.writeStringBundleE(bs);
            
            // Flags at offset 0xF28
            bs.writeCompressedU8(3);  // offset 0xF28 (3880) - default value from ctor
            bs.writeCompressedU8(0);  // offset 0xF29 (3881)
            bs.writeCompressedU16(0); // offset 0xF2A (3882) - ProfileC array count = 0
            // (No ProfileC array entries since count = 0)
            
            // Flag + CompactVec3 Block 1 (offset 0x49C4 / 18884)
            bs.writeBit(true);        // offset 0x49C4 (18884) - default 1 from ctor
            this.writeCompactVec3(bs); // offset 0x49C8 (18888)
            
            // Timestamps (offset 0x49D8 / 18904)
            bs.writeCompressedU32(0); // offset 0x49D8 (18904)
            bs.writeCompressedU32(0); // offset 0x49DC (18908)
            
            // Flag + ID (offset 0x49E0 / 18912)
            bs.writeBit(false);       // offset 0x49E0 (18912)
            bs.writeCompressedU16(0); // offset 0x49E2 (18914)
            
            // EntryGBlock (offset 0x49E4 / 18916)
            this.writeEntryGBlock(bs);
            
            // Blob2048 (offset 0x4A60 / 19040) - vtbl+52 call
            this.writeBlob2048(bs);
            
            // Block0C9C - sub_100DDE70 (offset 0xC9C / 3228)
            this.writeTableIBlock(bs);
            
            // CompactVec3 Block 2 (offset 0x4A80 / 19072)
            this.writeCompactVec3(bs);
            
            // Final flag + block (offset 0x4A90 / 19088)
            bs.writeBit(false);       // offset 0x4A90 (19088)
            this.writeFinalBlock(bs); // offset 0x4A94 (19092)
            
            return bs.getData();
        } finally {
            bs.destroy();
        }
    }

    /**
     * ProfileA - sub_100EAAF0
     * Contains 5 sub-blocks:
     * 1. sub_100CA710 (main header + array)
     * 2. sub_100EBB30 (12 optional item blocks)
     * 3. sub_10101BF0 (3 optional item blocks)
     * 4. sub_10101E20 (6 optional item blocks)
     * 5. sub_100CA710 (another profile array)
     */
    private writeProfileA(bs: NativeBitStream): void {
        // Block 1: sub_100CA710 - profile header
        bs.writeCompressedU16(0); // header field 0
        bs.writeCompressedU32(0); // field at +20
        bs.writeCompressedU32(0); // field at +24
        bs.writeCompressedU32(0); // field at +28
        bs.writeCompressedU16(0); // array count = 0 (no entries)
        
        // Block 2: sub_100EBB30 - 12 optional item blocks
        for (let i = 0; i < 12; i++) {
            bs.writeBit(false); // hasEntry = false
        }
        
        // Block 3: sub_10101BF0 - 3 optional item blocks
        for (let i = 0; i < 3; i++) {
            bs.writeBit(false); // hasEntry = false
        }
        
        // Block 4: sub_10101E20 - 6 optional item blocks
        for (let i = 0; i < 6; i++) {
            bs.writeBit(false); // hasEntry = false
        }
        
        // Block 5: sub_100CA710 again - another profile array
        bs.writeCompressedU16(0); // header field 0
        bs.writeCompressedU32(0); // field at +20
        bs.writeCompressedU32(0); // field at +24
        bs.writeCompressedU32(0); // field at +28
        bs.writeCompressedU16(0); // array count = 0
    }

    /**
     * ProfileB - WorldLogin_WriteProfileBlockB @ 0x100ea9e0
     * 4 iterations, each writes u16c from (this + 2 + i*16)
     */
    private writeProfileB(bs: NativeBitStream): void {
        for (let i = 0; i < 4; i++) {
            bs.writeCompressedU16(0);
        }
    }

    /**
     * ProfileC - WorldLogin_WriteProfileBlockC @ 0x100c8b80
     * Read by WorldLogin_ReadProfileBlockC @ 0x100c8d20
     * 
     * Contains character appearance data. Structure (50 bytes when unpacked to u16 array):
     * - [0] gender: 0=male, 1=female
     * - [1] skinColor: 0=white, 1=black
     * - [2] headTextureIdx: 0-27
     * - [3] hairTextureIdx: 0-22
     * - [4-5] unknown u32
     * - [6-7] unknown
     * - [8] torsoTypeId: e.g. 611 (male), 797 (female)
     * - [9] legsTypeId: e.g. 760 (male), 907 (female)
     * - [10] shoesTypeId: e.g. 500 (male), 510 (female)
     * - [11-19] ability/accessory slots
     * - [20-24] flags
     */
    private writeProfileC(bs: NativeBitStream): void {
        // Default male character appearance
        const MALE_TORSO = 611;   // Type 11/13 item
        const MALE_LEGS = 760;    // Type 12/14 item
        const MALE_SHOES = 500;   // Type 15 item
        
        // bits[1] - offset 0: gender (0=male)
        bs.writeBits(Buffer.from([0]), 1, true);
        // bits[1] - offset 2: skinColor (0=white)
        bs.writeBits(Buffer.from([0]), 1, true);
        // bits[5] - offset 4: headTextureIdx (0)
        bs.writeBits(Buffer.from([0]), 5, true);
        // bits[5] - offset 6: hairTextureIdx (0)
        bs.writeBits(Buffer.from([0]), 5, true);
        // bits[32] - offset 8: unknown u32
        bs.writeBits(Buffer.from([0, 0, 0, 0]), 32, true);
        // bits[5] - offset 10: unknown
        bs.writeBits(Buffer.from([0]), 5, true);
        // bits[6] - offset 12: unknown
        bs.writeBits(Buffer.from([0]), 6, true);
        // bits[4] - offset 14: unknown
        bs.writeBits(Buffer.from([0]), 4, true);
        
        // bits[12] - offset 16: torsoTypeId (611 = 0x263)
        this.writeBits12(bs, MALE_TORSO);
        // bits[12] - offset 18: legsTypeId (760 = 0x2F8)
        this.writeBits12(bs, MALE_LEGS);
        // bits[12] - offset 20: shoesTypeId (500 = 0x1F4)
        this.writeBits12(bs, MALE_SHOES);
        
        // Optional ability section - all zeros, write bit 0 (no abilities)
        bs.writeBit(false);
        
        // bits[1] × 4 - flags at offsets 40, 42, 44, 46
        bs.writeBits(Buffer.from([0]), 1, true);
        bs.writeBits(Buffer.from([0]), 1, true);
        bs.writeBits(Buffer.from([0]), 1, true);
        bs.writeBits(Buffer.from([0]), 1, true);
    }
    
    private writeBits12(bs: NativeBitStream, value: number): void {
        // Write 12 bits in little-endian order (low byte first)
        const buf = Buffer.alloc(2);
        buf.writeUInt16LE(value & 0xFFF, 0);
        bs.writeBits(buf, 12, true);
    }

    /**
     * ProfileD - WorldLogin_WriteProfileBlockD @ 0x100e3440
     * 53 compressed u32 values
     */
    private writeProfileD(bs: NativeBitStream): void {
        for (let i = 0; i < 53; i++) {
            bs.writeCompressedU32(0);
        }
    }

    /**
     * StringBundleE - WorldLogin_WriteStringBundleE @ 0x1007aa30
     * Read by WorldLogin_ReadStringBundleE @ 0x10078b80
     * 
     * Contains: u32c bundleId + bit flag + 4 huffman-encoded blob strings
     * 
     * Field mapping (from Handle_ID_WORLD_LOGIN @ 0x1007adcd):
     * - offset 5:   playerName (max 20 bytes) -> SharedStringTable key 11219
     * - offset 25:  avatarData (max 544 bytes) -> SharedStringTable key 11224
     * - offset 57:  factionOrTitle (max 36 bytes) -> SharedStringTable key 126546
     * - offset 569: unknownBlob (not written to SharedStringTable)
     */
    private writeStringBundleE(bs: NativeBitStream): void {
        bs.writeCompressedU32(0); // bundleId
        bs.writeBit(false);       // flag at offset 4
        
        // 4 huffman-encoded blob strings (each via vtbl+52)
        this.writeBlob2048(bs); // offset 5: playerName (key 11219) - used in player interaction
        this.writeBlob2048(bs); // offset 25: avatarData (key 11224) - appearance/avatar customization
        this.writeBlob2048(bs); // offset 57: factionOrTitle (key 126546) - faction/guild/title
        this.writeBlob2048(bs); // offset 569: unknownBlob - purpose unknown
    }

    /**
     * CompactVec3 - sub_100DF040 -> sub_100E1F10 + 9 bits
     * Writes position as packed bits based on precision
     */
    private writeCompactVec3(bs: NativeBitStream): void {
        // sub_100E1F10 with precision >= 16 writes 3 u16c values
        // For precision < 16, it writes abs values + sign bits
        // Default precision is 16, so use u16c path
        bs.writeCompressedU16(0); // x
        bs.writeCompressedU16(0); // y
        bs.writeCompressedU16(0); // z
        
        // bits[9] at offset 12
        bs.writeBits(Buffer.from([0, 0]), 9, true);
    }

    /**
     * EntryGBlock - WorldLogin_WriteEntryGBlock @ 0x10017390
     * u32c header + 10 entries via WorldLogin_WriteEntryG
     */
    private writeEntryGBlock(bs: NativeBitStream): void {
        bs.writeCompressedU32(0); // entryHeader
        
        // 10 entries - each checks if entry is valid
        for (let i = 0; i < 10; i++) {
            // WorldLogin_WriteEntryG: if !this[5] || !this[4] -> write bit 0
            bs.writeBit(false); // no entry
        }
    }

    /**
     * Blob2048 - variable length blob, max 2048 bits
     * Format: u32c bit length, then raw bits (huffman encoded string)
     */
    private writeBlob2048(bs: NativeBitStream): void {
        bs.writeCompressedU32(0); // bit length = 0 (empty string)
    }

    /**
     * TableI Block - sub_100DDE70 (at offset 0xC9C / 3228)
     * 4 u8c + 1 u32c + u32c count + entries
     */
    private writeTableIBlock(bs: NativeBitStream): void {
        bs.writeCompressedU8(0);  // offset +36
        bs.writeCompressedU8(0);  // offset +37
        bs.writeCompressedU8(0);  // offset +38
        bs.writeCompressedU8(0);  // offset +39
        bs.writeCompressedU32(0); // offset +32
        bs.writeCompressedU32(0); // entry count = 0
        // (No entries since count = 0)
    }

    /**
     * Final Block - sub_100E63C0 (at offset 0x4A94 / 19092)
     * u32c + nested block + u32c count + entries
     */
    private writeFinalBlock(bs: NativeBitStream): void {
        bs.writeCompressedU32(0); // header at offset 0
        
        // sub_100D0E50 - nested block (need to decompile for exact format)
        // For now write minimal structure
        bs.writeCompressedU32(0);
        
        bs.writeCompressedU32(0); // entry count = 0
        // (No entries since count = 0)
    }

    static decode(_buffer: Buffer): IdRegisterClientReturnPacket {
        throw new Error('IdRegisterClientReturnPacket decode not implemented - server->client only');
    }

    toString(): string {
        return `IdRegisterClientReturnPacket { worldId: ${this.worldId}, playerId: ${this.playerId}, flags: ${this.flags} }`;
    }
}
