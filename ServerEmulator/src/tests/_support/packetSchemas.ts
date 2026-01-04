import { PacketSchema } from './packetDecode';

function isPrintableAscii(value: string): boolean {
    for (let i = 0; i < value.length; i += 1) {
        const c = value.charCodeAt(i);
        if (c < 0x20 || c > 0x7e) return false;
    }
    return true;
}

export const LOGIN_6B_SCHEMA: PacketSchema = {
    name: 'login_6b',
    msgId: 0x6b,
    wrapper: 'reliable',
    scan: 'byte',
    bitOrder: 'msb',
    fields: [
        { name: 'username', type: 'huffman_string_compressed', maxLen: 2048 },
        { name: 'clientVersion', type: 'u16c' },
    ],
    validate: (fields) => {
        const username = String(fields.username ?? '');
        const clientVersion = Number(fields.clientVersion ?? 0);
        let score = 0;
        if (isPrintableAscii(username)) score += 10;
        if (username.length >= 3 && username.length <= 64) score += 5;
        if (clientVersion !== 0) score += 2;
        return { ok: score >= 10, score };
    },
};

export const OPEN_CONN_09_SCHEMA: PacketSchema = {
    name: 'open_connection_request_09',
    msgId: 0x09,
    wrapper: 'raw',
    scan: 'byte',
    bitOrder: 'msb',
    startOffset: 0,
    fields: [{ name: 'payload', type: 'bytes', length: 'rest' }],
    validate: (fields) => {
        const payload = fields.payload as Buffer | undefined;
        const len = payload ? payload.length : 0;
        const score = len > 0 ? 5 : 0;
        return { ok: len > 0, score };
    },
};

export const LOGIN_6D_SCHEMA: PacketSchema = {
    name: 'login_6d',
    msgId: 0x6d,
    wrapper: 'raw',
    scan: 'byte',
    bitOrder: 'msb',
    fields: [
        { name: 'success', type: 'u8c' },
        { name: 'username', type: 'huffman_string_compressed', maxLen: 2048 },
    ],
    validate: (fields) => {
        const success = Number(fields.success ?? 0);
        const username = String(fields.username ?? '');
        let score = 0;
        if (success === 1) score += 5;
        if (isPrintableAscii(username)) score += 5;
        if (username.length > 0 && username.length <= 64) score += 2;
        return { ok: score >= 8, score };
    },
};

export const PACKET_SCHEMAS: PacketSchema[] = [
    LOGIN_6B_SCHEMA,
    LOGIN_6D_SCHEMA,
    OPEN_CONN_09_SCHEMA,
];
