import { expect, test } from 'bun:test';
import {
    DeliveryTrace,
    traceBeginEvaluation,
    traceSplit,
    traceJoin,
    traceGeneratedText,
    traceBeforeMutation
} from '../../src/provenance/deliveryTrace';
import { XmlNode } from '../../src/xml/xmlNode';

const text = (value: string) => XmlNode.createTextNode(value);
const root = (...nodes: ReturnType<typeof text>[]) => {
    const parent = XmlNode.createGeneralNode('root');
    nodes.forEach(node => XmlNode.appendChild(parent, node));
    return parent;
};

test('cloned partial text retains exact ranges without values or serialized markers', () => {
    const original = text('DELIVERED OMITTED');
    const tree = root(original);
    const before = XmlNode.serialize(tree);
    const trace = new DeliveryTrace();
    trace.attachPart('word/document.xml', tree);
    expect(XmlNode.serialize(tree)).toBe(before);
    const clone = XmlNode.cloneNode(original, true);
    const originBefore = traceBeforeMutation(original);
    original.textContent = 'DELIVERED';
    clone.textContent = ' OMITTED';
    traceSplit(originBefore, original, clone, 9);
    trace.collectPart('word/document.xml', tree);
    const receipt = trace.result();
    expect(receipt.valid).toBe(true);
    expect(receipt.parts[0].text).toEqual([{ origin: 2, start: 0, end: 9 }]);
    expect(JSON.stringify(receipt)).not.toContain('DELIVERED');
    expect(JSON.stringify(receipt)).not.toContain('OMITTED');
});

test('join and generated replacement do not retain rendered PII as source', () => {
    const first = text('one'),
        second = text('two');
    const tree = root(first, second);
    const trace = new DeliveryTrace();
    trace.attachPart('word/document.xml', tree);
    const inputs = [first, second].map(traceBeforeMutation);
    first.textContent = 'onetwo';
    traceJoin(first, inputs);
    XmlNode.remove(second);
    const before = traceBeforeMutation(first);
    first.textContent = 'private value';
    traceGeneratedText(first, before);
    trace.collectPart('word/document.xml', tree);
    expect(trace.result().valid).toBe(true);
    expect(trace.result().parts[0].text).toEqual([]);
    expect(JSON.stringify(trace.result())).not.toContain('private');
});

test('untracked text and attribute edits fail proof without changing output', () => {
    for (const attribute of [false, true]) {
        const first = text('source'),
            tree = root(first);
        const trace = new DeliveryTrace();
        trace.attachPart('part', tree);
        if (attribute) tree.attributes = { new: 'unknown' };
        else first.textContent = 'changed';
        const output = XmlNode.serialize(tree);
        trace.collectPart('part', tree);
        expect(trace.result()).toMatchObject({
            valid: false,
            parts: [],
            diagnostic: 'deliveryScope.untrackedMutation'
        });
        expect(XmlNode.serialize(tree)).toBe(output);
    }
});

test('concurrent private traces cannot borrow another render origins', async () => {
    const results = await Promise.all(
        Array.from({ length: 20 }, async (_, index) => {
            const node = text(String(index)),
                tree = root(node),
                trace = new DeliveryTrace();
            trace.attachPart(`part-${index}`, tree);
            await Promise.resolve();
            const clone = XmlNode.cloneNode(node, true);
            XmlNode.appendChild(tree, clone);
            trace.collectPart(`part-${index}`, tree);
            return trace.result();
        })
    );
    expect(results.every(result => result.valid)).toBe(true);
    expect(results.map(result => result.parts[0].path)).toEqual(
        Array.from({ length: 20 }, (_, index) => `part-${index}`)
    );
});

test('untracked mutation cannot be laundered through split join or clone', () => {
    for (const operation of ['split', 'join', 'clone']) {
        const node = text('secret'),
            tree = root(node),
            trace = new DeliveryTrace();
        trace.attachPart('part', tree);
        node.textContent = 'public';
        if (operation === 'clone') XmlNode.appendChild(tree, XmlNode.cloneNode(node, true));
        else if (operation === 'split') {
            const before = traceBeforeMutation(node),
                other = text('lic');
            node.textContent = 'pub';
            traceSplit(before, node, other, 3);
        } else {
            const before = traceBeforeMutation(node);
            traceJoin(node, [before]);
        }
        trace.collectPart('part', tree);
        expect(trace.result()).toMatchObject({ valid: false, parts: [] });
    }
});

test('generated spans preserve offsets when later joined and split', () => {
    const first = text('{value}'),
        second = text('RETAINED'),
        tree = root(first, second),
        trace = new DeliveryTrace();
    trace.attachPart('part', tree);
    const generated = traceBeforeMutation(first);
    first.textContent = 'long private value';
    traceGeneratedText(first, generated);
    const inputs = [first, second].map(traceBeforeMutation);
    first.textContent += 'RETAINED';
    traceJoin(first, inputs);
    XmlNode.remove(second);
    const before = traceBeforeMutation(first),
        tail = XmlNode.cloneNode(first, true);
    first.textContent = 'long private value';
    tail.textContent = 'RETAINED';
    traceSplit(before, first, tail, 18);
    XmlNode.remove(first);
    XmlNode.appendChild(tree, tail);
    trace.collectPart('part', tree);
    expect(trace.result().valid).toBe(true);
    expect(trace.projectStaticPart('part')).toContain('RETAINED');
    expect(trace.projectStaticPart('part')).not.toContain('value');
});

test('node type and name changes cannot launder removed source through tracked mutations', () => {
    for (const operation of ['collect', 'clone', 'split', 'join']) {
        for (const mutation of ['type', 'name']) {
            const node = text('REMOVED_SENTINEL'),
                tree = root(node),
                trace = new DeliveryTrace();
            trace.attachPart('part', tree);
            if (mutation === 'type') {
                (node as any).nodeType = 'General';
                (node as any).nodeName = 'empty';
            } else (node as any).nodeName = 'renamed';
            if (operation === 'clone' && mutation === 'type') XmlNode.appendChild(tree, XmlNode.cloneNode(node, true));
            else if (operation === 'clone') traceBeforeMutation(node);
            else if (operation === 'split')
                traceSplit(traceBeforeMutation(node), node, text(''), node.textContent.length);
            else if (operation === 'join') traceJoin(node, [traceBeforeMutation(node)]);
            trace.collectPart('part', tree);
            expect(trace.result()).toMatchObject({ valid: false, parts: [] });
            expect(trace.projectStaticPart('part')).toBeNull();
        }
    }
});

test('post-snapshot structural edits fail tracked writes and invisible text children fail collection', () => {
    for (const operation of ['split', 'join', 'generated']) {
        const node = text('sentinel'),
            tree = root(node),
            trace = new DeliveryTrace();
        trace.attachPart('part', tree);
        const before = traceBeforeMutation(node);
        (node as any).nodeType = 'General';
        (node as any).nodeName = 'empty';
        if (operation === 'split') traceSplit(before, node, text(''), 8);
        else if (operation === 'join') traceJoin(node, [before]);
        else traceGeneratedText(node, before);
        trace.collectPart('part', tree);
        expect(trace.result().valid).toBe(false);
        expect(trace.projectStaticPart('part')).toBeNull();
    }
    const shown = text('shown'),
        hidden = text('REMOVED_SENTINEL'),
        tree = root(shown, hidden),
        trace = new DeliveryTrace();
    trace.attachPart('part', tree);
    XmlNode.remove(hidden);
    shown.childNodes = [hidden];
    hidden.parentNode = shown;
    expect(XmlNode.serialize(tree)).not.toContain('REMOVED_SENTINEL');
    trace.collectPart('part', tree);
    expect(trace.result().valid).toBe(false);
    expect(trace.projectStaticPart('part')).toBeNull();
});

test('only final retained generated intervals authorize their evaluation contribution', () => {
    for (const retainGenerated of [true, false]) {
        const generated = text('{value}'),
            adjacent = text('STATIC');
        const tree = root(generated, adjacent),
            trace = new DeliveryTrace();
        trace.attachPart('part', tree);
        const evaluation = traceBeginEvaluation(generated)!;
        evaluation.branch('root.choice', false);
        const before = traceBeforeMutation(generated);
        generated.textContent = 'VALUE';
        traceGeneratedText(generated, before, evaluation);
        const joined = [generated, adjacent].map(traceBeforeMutation);
        generated.textContent = 'VALUESTATIC';
        traceJoin(generated, joined);
        XmlNode.remove(adjacent);
        const split = traceBeforeMutation(generated);
        const second = XmlNode.cloneNode(generated, true);
        generated.textContent = 'VALUE';
        second.textContent = 'STATIC';
        traceSplit(split, generated, second, 5);
        if (!retainGenerated) {
            XmlNode.remove(generated);
            XmlNode.appendChild(tree, second);
        }
        trace.collectPart('part', tree);
        expect(trace.result().valid).toBe(true);
        expect(trace.result().contributions).toHaveLength(retainGenerated ? 1 : 0);
        if (retainGenerated)
            expect(trace.result().contributions[0].events).toEqual([{ path: 'root.choice', selected: false }]);
        expect(JSON.stringify(trace.result())).not.toContain('VALUE');
    }
});
