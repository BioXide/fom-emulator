export enum NetworkLayer {
    MMO,
    GAME,
}

export abstract class Packet {
    static RAKNET_ID: number;

    abstract encode(): Buffer;

    static decode(_buffer: Buffer): Packet {
        throw new Error('Not implemented');
    }
}
