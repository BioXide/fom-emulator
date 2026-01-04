import assert from 'assert/strict';
import { resetHuffmanCache } from '../protocol/RakStringCompressor';
import { loadFixtures } from './_support/fixtures';
import { decodeLogin6bFromPacket, hexToBuffer } from './_support/packetDecode';

function runLoginFixtures(label: string): void {
    const fixtures = loadFixtures().filter((fixture) => fixture.msg_id === 0x6b);
    if (fixtures.length === 0) {
        console.log(`${label}: no login_6b fixtures; skipping`);
        return;
    }
    assert.ok(fixtures.length >= 1, `${label}: expected at least one login fixture`);

    for (const fixture of fixtures) {
        const packet = hexToBuffer(fixture.hex);
        const decoded = decodeLogin6bFromPacket(packet);
        assert.ok(decoded, `${label}: ${fixture.name} decode returned null`);
        assert.ok(decoded.ok, `${label}: ${fixture.name} score too low`);
        if (!fixture.expected) {
            throw new Error(`${label}: ${fixture.name} missing expected values`);
        }
        assert.equal(
            decoded.username,
            fixture.expected.username,
            `${label}: ${fixture.name} username mismatch`,
        );
        assert.equal(
            decoded.clientVersion,
            fixture.expected.clientVersion ?? 0,
            `${label}: ${fixture.name} clientVersion mismatch`,
        );
    }
}

resetHuffmanCache();
const envBackup = process.env.FOM_HUFFMAN_TABLE;
delete process.env.FOM_HUFFMAN_TABLE;
runLoginFixtures('default-table');

if (envBackup === undefined) {
    delete process.env.FOM_HUFFMAN_TABLE;
} else {
    process.env.FOM_HUFFMAN_TABLE = envBackup;
}
