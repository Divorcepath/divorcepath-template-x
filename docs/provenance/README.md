# Private origin instrumentation — first review slice

This branch is based on a510e2865ba5807521d088ab134cbdcc7321c02c. `installed-baseline.patch` is a separate overlay restoring the exact excludable-section behavior shipped in locked JSR4.1.7 revision11; `installed-baseline.json` hashes every installed source/JS/map file. Source comparison:94 TS files equal the committed baseline, the section strategy requires that overlay, and the unused loopListStrategy was not shipped. It remains excluded from the package build. No package publication occurs.

`DeliveryTrace` is an XML origin trace, **not an authoring proof**. Its result always says `scope: xml-origin-trace`, `authoringReady: false`. It tracks original UTF-16 text intervals and source attribute names through clones, splits, joins and declared generated replacements. Node type/name and leaf-node shape are captured and validated before mutation and at collection; text nodes with undeclared child nodes fail because their serializer ignores those children. Mutation inputs are validated before changes; untracked changes cannot be blessed by subsequent tracked operations. Generated text carries non-source intervals so later slicing does not shift source offsets. Per-node WeakMap entries hold their own per-render owner; there is no ambient observer. The receipt contains IDs/ranges/names only, while source snapshots remain private in memory.

`projectStaticPart` demonstrates bounded source-region projection for review. It deliberately omits generated values/bindings and is NOT a usable authoring template or package. It must not be wired to downloads or replace the native receipt-aware transfer. Native retained occurrence reconciliation, expression result-contribution association, reference closure and portable contract reconstruction remain pending Unit06D work.

Unsupported at this slice: arbitrary rawXML plugins, XML comments, custom plugins that mutate text/attributes without observer calls, package parts not represented by the TemplateX content-part renderer, and proof limits. These invalidate trace and return no projected part without changing rendered output. Generated text/image/link/section wrapper nodes are explicitly declared; unknown generated nodes fail proof. Source relationships/assets still require final package inventory and native closure validation; mere presence does not authorize copying.

Bounds:100,000 nodes,200,000 cumulative intervals,100,000 events,128 parts,16MiB conservative source text/attribute storage,1MiB conservative receipt allocation, depth64. Generated-tree event accounting and final reachability use these same owners. Full package byte/decompression bounds live in the API inventory adapter.

Build:

    node scripts/build-provenance-package.mjs
    node_modules/.bin/tsc -p tsconfig.provenance.json
    bun test test/provenance

The deterministic builder uses TypeScript5.8.3, emits repository-relative modules, rewrites TS-only import extensions and expands existing `nameof` macros to the same identifier/property strings as the installed build. It records all input hashes and compiler version in the output package. `out/` is ignored and not a final runtime dependency path. The eventual API vendor artifact must be copied from a reviewed isolated commit, include this build provenance, and be referenced relatively.

The dedicated source typecheck supplies the existing build-time nameof macro declaration and disables noUnusedLocals solely because baseline office/docx.ts has an existing unused XmlNode import. No source type errors are waived. No final API dependency refers to this absolute worktree.

Actual compiled-package tests compare every decompressed ZIP part against the installed unmodified package for hidden conditions, repeats, multiline values, excludable/hidable sections, headers/footers, images/links and unsupported rawXML. Sidecar tests cover mixed generated/source offsets, concurrent ownership and untracked-edit laundering through clone/split/join. Broader repository test suites and native/API integration are required before whole Unit06D acceptance.
