import { expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

test('clean build binds all outputs and reproduces identical manifest without stale files', () => {
    const root = path.resolve(import.meta.dirname, '../..');
    const output = path.join(root, 'out/provenance-test-package');
    const build = () => execFileSync('node', ['scripts/build-provenance-package.mjs', '--test-output'], { cwd: root });
    build();
    const first = fs.readFileSync(path.join(output, 'build-provenance.json'), 'utf8');
    fs.writeFileSync(path.join(output, 'stale-private-source.js'), 'MUST_NOT_SHIP');
    build();
    expect(fs.existsSync(path.join(output, 'stale-private-source.js'))).toBe(false);
    expect(fs.readFileSync(path.join(output, 'build-provenance.json'), 'utf8')).toBe(first);
    const manifest = JSON.parse(first);
    expect(manifest.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(manifest.compilerSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.buildScriptSha256).toMatch(/^[a-f0-9]{64}$/);
    const files = fs
        .readdirSync(output, { recursive: true })
        .filter(file => fs.statSync(path.join(output, String(file))).isFile());
    expect(files.map(String).sort()).toEqual([...Object.keys(manifest.outputSha256), 'build-provenance.json'].sort());
    for (const [file, hash] of Object.entries(manifest.outputSha256)) {
        expect(path.isAbsolute(file)).toBe(false);
        expect(
            crypto
                .createHash('sha256')
                .update(fs.readFileSync(path.join(output, file)))
                .digest('hex')
        ).toBe(hash);
    }
    expect(first.includes(root)).toBe(false);
}, 30_000);
