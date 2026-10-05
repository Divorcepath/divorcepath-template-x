import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(
    root,
    process.argv.includes('--test-output') ? 'out/provenance-test-package' : 'out/provenance-package'
);
// This directory is exclusively generated: stale modules must never enter the package.
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const hashes = {};
const outputHashes = {};
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
function writeOutput(relative, bytes) {
    const target = path.join(out, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    outputHashes[relative] = sha256(bytes);
}
const visit = context => {
    const transform = node => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'nameof') {
            if (node.arguments.length !== 1) throw new Error('Unsupported nameof macro');
            const argument = node.arguments[0];
            if (ts.isIdentifier(argument)) return ts.factory.createStringLiteral(argument.text);
            if (ts.isPropertyAccessExpression(argument)) return ts.factory.createStringLiteral(argument.name.text);
            throw new Error('Unsupported nameof macro');
        }
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier) &&
            node.moduleSpecifier.text.endsWith('.ts')
        ) {
            const specifier = ts.factory.createStringLiteral(node.moduleSpecifier.text.slice(0, -3) + '.js');
            return ts.isImportDeclaration(node)
                ? ts.factory.updateImportDeclaration(
                      node,
                      node.modifiers,
                      node.importClause,
                      specifier,
                      node.attributes
                  )
                : ts.factory.updateExportDeclaration(
                      node,
                      node.modifiers,
                      node.isTypeOnly,
                      node.exportClause,
                      specifier,
                      node.attributes
                  );
        }
        return ts.visitEachChild(node, transform, context);
    };
    return node => ts.visitNode(node, transform);
};
function walk(dir) {
    for (const file of fs.readdirSync(dir).sort()) {
        const absolute = path.join(dir, file);
        if (fs.statSync(absolute).isDirectory()) {
            walk(absolute);
            continue;
        }
        if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue;
        const relative = path.relative(root, absolute);
        if (relative === 'src/plugins/sections/strategy/loopListStrategy.ts') continue; // not shipped in locked JSR revision11
        const source = fs.readFileSync(absolute, 'utf8');
        hashes[relative] = sha256(source);
        const result = ts.transpileModule(source, {
            compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
            transformers: { before: [visit] },
            reportDiagnostics: true,
            fileName: absolute
        });
        if (result.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error))
            throw new Error('Source transpilation failed');
        writeOutput(relative.slice(0, -3) + '.js', result.outputText);
    }
}
walk(path.join(root, 'src'));
const upstream = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
writeOutput(
    'package.json',
    JSON.stringify(
        {
            name: '@divorcepath/template-x-provenance',
            version: '4.1.7-provenance.0',
            type: 'module',
            exports: { '.': './src/index.js' },
            dependencies: upstream.dependencies
        },
        null,
        2
    ) + '\n'
);
writeOutput('LICENSE', fs.readFileSync(path.join(root, 'LICENSE')));
fs.writeFileSync(
    path.join(out, 'build-provenance.json'),
    JSON.stringify(
        {
            schemaVersion: 1,
            sourceCommit,
            typescript: ts.version,
            compilerSha256: sha256(fs.readFileSync(path.join(root, 'node_modules/typescript/lib/typescript.js'))),
            buildScriptSha256: sha256(fs.readFileSync(import.meta.filename)),
            packageMetadataSha256: sha256(fs.readFileSync(path.join(root, 'package.json'))),
            baselineManifestSha256: sha256(fs.readFileSync(path.join(root, 'docs/provenance/installed-baseline.json'))),
            baseline: '@jsr/whekin__divorcepath-template-x@4.1.7 revision11',
            sourceSha256: hashes,
            outputSha256: outputHashes
        },
        null,
        2
    ) + '\n'
);
console.log(`Built ${Object.keys(hashes).length} modules with TypeScript ${ts.version}`);
