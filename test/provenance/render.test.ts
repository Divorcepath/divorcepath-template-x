import { expect, test } from 'bun:test';
import PizZip from 'pizzip';
import { TemplateHandler as BaselineHandler } from '@whekin/divorcepath-template-x';
import { TemplateHandler } from '../../out/provenance-package/src/index.js';
import { DeliveryTrace } from '../../out/provenance-package/src/index.js';
const fixture = (text: string) => {
    const zip = new PizZip();
    zip.file(
        '[Content_Types].xml',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    );
    zip.file(
        '_rels/.rels',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    );
    zip.file(
        'word/document.xml',
        `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`
    );
    return zip.generate({ type: 'nodebuffer' });
};
const parts = (bytes: Buffer) =>
    Object.fromEntries(
        Object.entries(new PizZip(bytes).files)
            .filter(([, f]) => !f.dir)
            .map(([p, f]) => [p, f.asText()])
    );
test('actual renderer observer preserves every package part for hidden conditional source', async () => {
    const bytes = fixture('Before {#show}UNDELIVERED_SENTINEL{/show} after');
    const expected = await new BaselineHandler().process(bytes, { show: false });
    const trace = new DeliveryTrace();
    const actual = await new TemplateHandler().process(bytes, { show: false }, trace);
    expect(parts(actual)).toEqual(parts(expected));
    expect(JSON.stringify(parts(actual))).not.toContain('UNDELIVERED_SENTINEL');
    expect(trace.result()).toMatchObject({ valid: true, diagnostic: null });
    const projection = trace.projectStaticPart('word/document.xml');
    expect(projection).not.toContain('UNDELIVERED_SENTINEL');
    expect(projection).toContain('Before ');
});
test('actual text replacement keeps package parity', async () => {
    const bytes = fixture('Hello {name}');
    const expected = await new BaselineHandler().process(bytes, { name: 'Synthetic' });
    const trace = new DeliveryTrace();
    const actual = await new TemplateHandler().process(bytes, { name: 'Synthetic' }, trace);
    expect(parts(actual)).toEqual(parts(expected));
    expect(trace.result()).toMatchObject({ valid: true, diagnostic: null });
});

test('repeated and multiline generated text preserve output and source range accounting', async () => {
    for (const [template, data] of [
        ['{#rows}Row {name}{/rows}', { rows: [{ name: 'A' }, { name: 'B' }] }],
        ['Hello {name}', { name: 'A\nB' }]
    ] as const) {
        const bytes = fixture(template),
            trace = new DeliveryTrace();
        const expected = await new BaselineHandler().process(bytes, data);
        const actual = await new TemplateHandler().process(bytes, data, trace);
        expect(parts(actual)).toEqual(parts(expected));
        expect(trace.result()).toMatchObject({ valid: true });
    }
});

test('installed excludable and hidable section semantics stay identical', async () => {
    for (const hideMode of ['excludable', 'hidable']) {
        const bytes = fixture('{^section}SECTION_SENTINEL{/section}');
        const data = {
            section: { _type: 'sections', section: { id: '100', name: 'section__1', hidden: true, hideMode } }
        };
        const expected = await new BaselineHandler().process(bytes, data);
        const trace = new DeliveryTrace();
        const actual = await new TemplateHandler().process(bytes, data, trace);
        expect(parts(actual)).toEqual(parts(expected));
        expect(trace.result()).toMatchObject({ valid: true });
        if (hideMode === 'excludable')
            expect(trace.projectStaticPart('word/document.xml')).not.toContain('SECTION_SENTINEL');
        else expect(trace.projectStaticPart('word/document.xml')).toContain('SECTION_SENTINEL');
    }
});

test('header and footer trace covers actual rendered parts', async () => {
    const zip = new PizZip(fixture('Body'));
    zip.file(
        'word/document.xml',
        zip
            .file('word/document.xml')!
            .asText()
            .replace(
                '</w:body>',
                '<w:sectPr><w:headerReference w:type="default" r:id="h1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><w:footerReference w:type="default" r:id="f1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></w:sectPr></w:body>'
            )
    );
    zip.file(
        'word/_rels/document.xml.rels',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="h1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="f1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>'
    );
    for (const name of ['header1', 'footer1'])
        zip.file(
            `word/${name}.xml`,
            '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>{#show}OMITTED_HEADER_FOOTER{/show} retained</w:t></w:r></w:p></w:hdr>'
        );
    const bytes = zip.generate({ type: 'nodebuffer' }),
        trace = new DeliveryTrace();
    const actual = await new TemplateHandler().process(bytes, { show: false }, trace);
    expect(parts(actual)).toEqual(parts(await new BaselineHandler().process(bytes, { show: false })));
    expect(trace.result()).toMatchObject({ valid: true });
    expect(trace.result().parts).toHaveLength(3);
    expect(trace.projectStaticPart('word/header1.xml')).not.toContain('OMITTED_HEADER_FOOTER');
    expect(trace.projectStaticPart('word/footer1.xml')).not.toContain('OMITTED_HEADER_FOOTER');
});

test('generated image and link markup preserve installed package behavior', async () => {
    for (const value of [
        { _type: 'image', source: Buffer.from('synthetic image'), format: 'image/png', width: 10, height: 10 },
        { _type: 'link', target: 'https://example.invalid/synthetic', text: 'Synthetic link' }
    ]) {
        const bytes = fixture('Before {value} after'),
            trace = new DeliveryTrace();
        const expected = await new BaselineHandler().process(bytes, { value });
        const actual = await new TemplateHandler().process(bytes, { value }, trace);
        expect(parts(actual)).toEqual(parts(expected));
        expect(trace.result()).toMatchObject({ valid: true });
    }
});
test('raw XML leaves ordinary rendering intact and explicitly refuses proof', async () => {
    const bytes = fixture('{value}'),
        data = { value: { _type: 'rawXml', xml: '<w:t>authored XML</w:t>' } },
        trace = new DeliveryTrace();
    const expected = await new BaselineHandler().process(bytes, data);
    const actual = await new TemplateHandler().process(bytes, data, trace);
    expect(parts(actual)).toEqual(parts(expected));
    expect(trace.result()).toMatchObject({
        valid: false,
        diagnostic: 'deliveryScope.unsupportedRawXml',
        authoringReady: false
    });
    expect(trace.projectStaticPart('word/document.xml')).toBeNull();
});

test('actual undeclared node-type mutation cannot restore absent text in source projection', async () => {
    const extension = {
        setUtilities() {},
        async execute(_data: unknown, context: any) {
            const pending = [await context.currentPart.xmlRoot()];
            while (pending.length) {
                const node = pending.pop();
                if (node.nodeType === 'Text' && node.textContent === 'REMOVED_SOURCE_SENTINEL') {
                    node.nodeType = 'General';
                    node.nodeName = 'w:br';
                }
                pending.push(...(node.childNodes ?? []));
            }
        }
    };
    const bytes = fixture('REMOVED_SOURCE_SENTINEL'),
        trace = new DeliveryTrace();
    const options = { extensions: { afterCompilation: [extension] } };
    const actual = await new TemplateHandler(options).process(bytes, {}, trace);
    expect(parts(actual)).toEqual(parts(await new BaselineHandler(options).process(bytes, {})));
    expect(JSON.stringify(parts(actual))).not.toContain('REMOVED_SOURCE_SENTINEL');
    expect(trace.result()).toMatchObject({ valid: false, diagnostic: 'deliveryScope.untrackedMutation' });
    expect(trace.projectStaticPart('word/document.xml')).toBeNull();
});

test('plugin detection evaluations do not authorize discarded branch decisions', async () => {
    const bytes = fixture('{value}');
    let calls = 0;
    const resolver = (args: any) => {
        const selected = ++calls === 1;
        args.deliveryEvaluation?.branch('root.choice', selected);
        return selected ? 'DISCARDED_BRANCH_SENTINEL' : 'DELIVERED_BRANCH';
    };
    const expected = await new BaselineHandler({ scopeDataResolver: resolver }).process(bytes, {});
    const expectedCalls = calls;
    calls = 0;
    const trace = new DeliveryTrace();
    const actual = await new TemplateHandler({ scopeDataResolver: resolver }).process(bytes, {}, trace);
    expect(calls).toBe(expectedCalls);
    expect(parts(actual)).toEqual(parts(expected));
    expect(JSON.stringify(parts(actual))).not.toContain('DISCARDED_BRANCH_SENTINEL');
    expect(trace.result().contributions).toHaveLength(1);
    expect(trace.result().contributions[0].events).toEqual([{ path: 'root.choice', selected: false }]);
});

test('private source occurrence bridge deduplicates repeat clones without exposing raw expressions', async () => {
    const bytes = fixture('{#rows}{name}{/rows}');
    const trace = new DeliveryTrace();
    await new TemplateHandler().process(bytes, { rows: [{ name: 'A' }, { name: 'B' }] }, trace);
    const source = trace.sourceOccurrences();
    expect(source.map(item => item.rawText)).toEqual(['{#rows}', '{name}', '{/rows}']);
    expect(source.map(item => item.ordinal)).toEqual([0, 1, 2]);
    expect(trace.result().contributions.map(item => item.sourceOccurrenceId)).toEqual([2, 2]);
    expect(JSON.stringify(trace.result())).not.toContain('{name}');
    expect(JSON.stringify(trace.result())).not.toContain('{#rows}');
});

test('nested repeat contributions preserve actual ancestry and container decisions', async () => {
    const bytes = fixture('{#rows}{name}{#children}{name}{/children}{/rows}');
    const data = {
        rows: [
            { name: 'OuterA', children: [{ name: 'InnerA' }, { name: 'InnerB' }] },
            { name: 'OuterB', children: [] }
        ]
    };
    const trace = new DeliveryTrace();
    const rendered = await new TemplateHandler().process(bytes, data, trace);
    expect(parts(rendered)).toEqual(parts(await new BaselineHandler().process(bytes, data)));
    const receipt = trace.result();
    expect(receipt.valid).toBe(true);
    expect(receipt.containers.map(item => item.count)).toEqual([2, 2, 0]);
    expect(receipt.contributions.map(item => item.ancestry?.map(ancestor => ancestor.iteration))).toEqual([
        [0],
        [0, 0],
        [0, 1],
        [1]
    ]);
    expect(receipt.contributions[1].ancestry?.[1].evaluationId).toBe(receipt.containers[1].evaluationId);
    expect(JSON.stringify(receipt)).not.toContain('OuterA');
    expect(JSON.stringify(receipt)).not.toContain('InnerB');
});
