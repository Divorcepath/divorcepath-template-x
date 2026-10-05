import type { Tag } from '../compilation/tag.js';
import type { XmlNode, XmlTextNode } from '../xml/xmlNode.js';
type SourceNode = {
    origin: number;
    name: string;
    type: string;
    text?: string;
    attributes: Record<string, string>;
    children: SourceNode[];
};
const escapeXml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

export type RepeatAncestor = { evaluationId: number; iteration: number };
export type OriginInterval = {
    origin: number;
    start: number;
    end: number;
    contribution?: number;
    ancestry?: RepeatAncestor[];
};
export type DeliveryEvaluation = {
    id: number;
    branch(path: string, selected: boolean): void;
    invalidate(code: string): void;
};
export type SourceOccurrence = {
    id: number;
    part: string;
    ordinal: number;
    rawText: string;
    disposition: string;
    source: OriginInterval[];
};
type EvaluationRecord = {
    id: number;
    sourceOccurrenceId?: number;
    ancestry?: RepeatAncestor[];
    source: OriginInterval[];
    events: { path: string; selected: boolean }[];
};
const evaluations = new WeakMap<DeliveryEvaluation, { owner: DeliveryTrace; record: EvaluationRecord }>();
type NodeState = {
    owner: DeliveryTrace;
    part: string;
    origin: number;
    nodeType: string;
    nodeName: string;
    intervals: OriginInterval[];
    expectedText?: string;
    expectedAttributes?: Record<string, string>;
    sourceAttributeNames?: string[];
    ancestry?: RepeatAncestor[];
};
// This registry holds no ambient/current render. Every node carries its own owner;
// concurrent render calls and recursive compilers cannot select another observer.
const states = new WeakMap<XmlNode, NodeState>();
export const DELIVERY_TRACE_LIMITS = Object.freeze({
    nodes: 100_000,
    intervals: 200_000,
    events: 100_000,
    parts: 128,
    sourceBytes: 16 * 1024 * 1024,
    receiptBytes: 1024 * 1024,
    depth: 64
});
export type DeliveryTraceResult = {
    schemaVersion: 1;
    scope: 'xml-origin-trace';
    authoringReady: false;
    valid: boolean;
    diagnostic: string | null;
    contributions: EvaluationRecord[];
    containers: {
        evaluationId: number;
        openOccurrenceId: number;
        closeOccurrenceId: number;
        count: number;
        condition: boolean;
        ancestry: RepeatAncestor[];
    }[];
    parts: {
        path: string;
        origins: number[];
        text: OriginInterval[];
        attributes: { origin: number; names: string[] }[];
        contributions: number[];
        instances: RepeatAncestor[];
    }[];
};

/** Private sidecar only. Results contain identities/ranges, never source or evaluated text. */
export class DeliveryTrace {
    private nodeCount = 0;
    private intervalCount = 0;
    private eventCount = 0;
    private sourceBytes = 0;
    private receiptBytes = 0;
    private diagnostic: string | null = null;
    private readonly containers: DeliveryTraceResult['containers'] = [];
    private repeatCount = 0;
    private readonly partTagCounts = new Map<string, number>();
    private readonly sourceTags = new Map<string, SourceOccurrence>();
    private readonly evaluationRecords: EvaluationRecord[] = [];
    private readonly roots = new Map<string, XmlNode>();
    private readonly sources = new Map<string, SourceNode>();
    private readonly collected: DeliveryTraceResult['parts'] = [];

    invalidate(code = 'deliveryScope.untrackedMutation'): void {
        this.diagnostic ??= code;
    }

    event(intervals = 0): boolean {
        if (this.diagnostic) return false;
        this.eventCount++;
        this.intervalCount += intervals;
        if (this.eventCount > DELIVERY_TRACE_LIMITS.events || this.intervalCount > DELIVERY_TRACE_LIMITS.intervals) {
            this.invalidate('deliveryScope.proofLimit');
            return false;
        }
        return true;
    }

    registerTag(tag: Tag, state: NodeState): void {
        if (state.intervals.some(span => !span.origin) || state.expectedText !== tag.rawText) {
            this.invalidate('deliveryScope.untrackedTag');
            return;
        }
        const key = this.tagKey(state);
        const existing = this.sourceTags.get(key);
        if (existing) {
            if (existing.rawText !== tag.rawText || existing.disposition !== tag.disposition)
                this.invalidate('deliveryScope.untrackedTag');
            return;
        }
        if (!this.event(state.intervals.length)) return;
        this.sourceBytes += tag.rawText.length * 2;
        if (this.sourceBytes > DELIVERY_TRACE_LIMITS.sourceBytes) {
            this.invalidate('deliveryScope.proofLimit');
            return;
        }
        this.sourceTags.set(key, {
            id: this.sourceTags.size + 1,
            part: state.part,
            ordinal: this.partTagCounts.get(state.part) ?? 0,
            rawText: tag.rawText,
            disposition: tag.disposition,
            source: state.intervals.map(span => ({ ...span }))
        });
        this.partTagCounts.set(state.part, (this.partTagCounts.get(state.part) ?? 0) + 1);
    }

    recordContainer(
        open: NodeState,
        close: NodeState,
        evaluation: DeliveryEvaluation,
        count: number,
        condition: boolean
    ): void {
        const binding = evaluations.get(evaluation);
        const openId = this.sourceTags.get(this.tagKey(open))?.id;
        const closeId = this.sourceTags.get(this.tagKey(close))?.id;
        if (
            !binding ||
            binding.owner !== this ||
            !openId ||
            !closeId ||
            close.owner !== this ||
            !Number.isSafeInteger(count) ||
            count < 0
        ) {
            this.invalidate();
            return;
        }
        this.repeatCount += count;
        if (this.repeatCount > 10_000 || !this.event()) {
            this.invalidate('deliveryScope.proofLimit');
            return;
        }
        this.receiptBytes += 160 + (open.ancestry?.length ?? 0) * 64;
        if (this.receiptBytes > DELIVERY_TRACE_LIMITS.receiptBytes) {
            this.invalidate('deliveryScope.proofLimit');
            return;
        }
        this.containers.push({
            evaluationId: evaluation.id,
            openOccurrenceId: openId,
            closeOccurrenceId: closeId,
            count,
            condition,
            ancestry: [...(open.ancestry ?? [])]
        });
    }

    private tagKey(state: NodeState): string {
        return JSON.stringify([state.part, state.intervals.map(span => [span.origin, span.start, span.end])]);
    }

    /** Server-only source bridge. Never include this inventory in delivery receipts. */
    sourceOccurrences(): SourceOccurrence[] {
        return this.diagnostic
            ? []
            : [...this.sourceTags.values()].map(item => ({ ...item, source: item.source.map(span => ({ ...span })) }));
    }

    beginEvaluation(state: NodeState): DeliveryEvaluation | undefined {
        const ancestryKey = JSON.stringify(state.ancestry ?? []);
        if (state.intervals.some(span => JSON.stringify(span.ancestry ?? []) !== ancestryKey)) {
            this.invalidate('deliveryScope.ambiguousAncestry');
            return undefined;
        }
        if (!this.event(state.intervals.length)) return undefined;
        this.receiptBytes +=
            128 +
            (state.ancestry?.length ?? 0) * 64 +
            state.intervals.reduce((size, span) => size + 80 + (span.ancestry?.length ?? 0) * 64, 0);
        if (this.receiptBytes > DELIVERY_TRACE_LIMITS.receiptBytes) {
            this.invalidate('deliveryScope.proofLimit');
            return undefined;
        }
        const record: EvaluationRecord = {
            id: this.evaluationRecords.length + 1,
            sourceOccurrenceId: this.sourceTags.get(this.tagKey(state))?.id,
            ancestry: [...(state.ancestry ?? [])],
            source: state.intervals.map(span => ({ ...span })),
            events: []
        };
        this.evaluationRecords.push(record);
        const decisions = new Map<string, boolean>();
        const handle: DeliveryEvaluation = {
            id: record.id,
            branch: (path, selected) => {
                if (record.events.length >= 1024 || path.length > 1024) {
                    this.invalidate('deliveryScope.proofLimit');
                    return;
                }
                if (decisions.has(path) && decisions.get(path) !== selected) {
                    this.invalidate('deliveryScope.ambiguousEvaluation');
                    return;
                }
                decisions.set(path, selected);
                if (!this.event()) return;
                this.receiptBytes += path.length * 6 + 64;
                if (this.receiptBytes > DELIVERY_TRACE_LIMITS.receiptBytes) {
                    this.invalidate('deliveryScope.proofLimit');
                    return;
                }
                record.events.push({ path, selected });
            },
            invalidate: code => this.invalidate(code)
        };
        evaluations.set(handle, { owner: this, record });
        return handle;
    }

    attachPart(path: string, root: XmlNode): void {
        if (this.roots.has(path) || this.roots.size >= DELIVERY_TRACE_LIMITS.parts) {
            this.invalidate('deliveryScope.proofLimit');
            return;
        }
        this.roots.set(path, root);
        const pending = [root];
        while (pending.length && !this.diagnostic) {
            const node = pending.pop()!;
            let depth = 0;
            for (let cursor: XmlNode | undefined = node; cursor; cursor = cursor.parentNode) {
                if (++depth > DELIVERY_TRACE_LIMITS.depth) {
                    this.invalidate('deliveryScope.proofLimit');
                    break;
                }
            }
            if (this.diagnostic) break;
            if (states.has(node)) {
                this.invalidate();
                break;
            }
            const origin = ++this.nodeCount;
            if (origin > DELIVERY_TRACE_LIMITS.nodes) {
                this.invalidate('deliveryScope.proofLimit');
                break;
            }
            const text = node.nodeType === 'Text' ? (node as XmlTextNode).textContent : undefined;
            const attributes = (node as XmlNode & { attributes?: Record<string, string> }).attributes;
            this.sourceBytes +=
                2 *
                ((text?.length ?? 0) +
                    Object.entries(attributes ?? {}).reduce((sum, [key, value]) => sum + key.length + value.length, 0));
            if (this.sourceBytes > DELIVERY_TRACE_LIMITS.sourceBytes) {
                this.invalidate('deliveryScope.proofLimit');
                break;
            }
            const intervals = text === undefined ? [] : [{ origin, start: 0, end: text.length }];
            if (!this.event(intervals.length)) break;
            states.set(node, {
                owner: this,
                part: path,
                origin,
                nodeType: node.nodeType,
                nodeName: node.nodeName,
                intervals,
                expectedText: text,
                expectedAttributes: attributes ? { ...attributes } : {},
                sourceAttributeNames: Object.keys(attributes ?? {})
            });
            if (node.nodeType === 'Comment') this.invalidate('deliveryScope.unsupportedComment');
            pending.push(...(node.childNodes ?? []).slice().reverse());
        }
        if (!this.diagnostic) {
            const snapshot = (node: XmlNode): SourceNode => ({
                origin: states.get(node)!.origin,
                name: node.nodeName,
                type: node.nodeType,
                text: node.nodeType === 'Text' ? (node as XmlTextNode).textContent : undefined,
                attributes: { ...(node as XmlNode & { attributes?: Record<string, string> }).attributes },
                children: (node.childNodes ?? []).map(snapshot)
            });
            this.sources.set(path, snapshot(root));
        }
    }

    /** Static source-region projection only; it is not an authoring contract or package proof. */
    projectStaticPart(path: string): string | null {
        if (!this.result().valid) return null;
        const part = this.collected.find(item => item.path === path);
        const source = this.sources.get(path);
        if (!part || !source) return null;
        const present = new Set(part.origins);
        const spans = new Map<number, OriginInterval[]>();
        for (const span of part.text) spans.set(span.origin, [...(spans.get(span.origin) ?? []), span]);
        const allowedAttributes = new Map(part.attributes.map(item => [item.origin, new Set(item.names)]));
        const project = (node: SourceNode): string => {
            if (node.type === 'Text') {
                const ranges = (spans.get(node.origin) ?? []).sort((a, b) => a.start - b.start);
                let end = 0;
                let value = '';
                for (const range of ranges) {
                    const start = Math.max(end, range.start);
                    if (range.end > start) value += node.text!.slice(start, range.end);
                    end = Math.max(end, range.end);
                }
                return escapeXml(value);
            }
            const children = node.children.map(project).join('');
            if (!present.has(node.origin) && !children) return '';
            const attributes = Object.entries(node.attributes)
                .filter(([key]) => allowedAttributes.get(node.origin)?.has(key))
                .map(([key, value]) => ` ${key}="${escapeXml(value)}"`)
                .join('');
            return children ? `<${node.name}${attributes}>${children}</${node.name}>` : `<${node.name}${attributes}/>`;
        };
        return project(source);
    }

    collectPart(path: string, root: XmlNode): void {
        if (this.roots.get(path) !== root) {
            this.invalidate();
            return;
        }
        const result: DeliveryTraceResult['parts'][number] = {
            path,
            origins: [],
            text: [],
            attributes: [],
            contributions: [],
            instances: []
        };
        const pending = [root];
        let visited = 0;
        const contributions = new Set<number>();
        const instances = new Map<string, RepeatAncestor>();
        while (pending.length && !this.diagnostic) {
            const node = pending.pop()!;
            let depth = 0;
            for (let cursor: XmlNode | undefined = node; cursor; cursor = cursor.parentNode) {
                if (++depth > DELIVERY_TRACE_LIMITS.depth) {
                    this.invalidate('deliveryScope.proofLimit');
                    break;
                }
            }
            if (this.diagnostic) break;
            if (++visited > DELIVERY_TRACE_LIMITS.nodes) {
                this.invalidate('deliveryScope.proofLimit');
                break;
            }
            const state = states.get(node);
            if (state && state.owner !== this) {
                this.invalidate();
                break;
            }
            // New generated nodes must be declared by the plugin that creates them.
            if (!state) {
                this.invalidate();
                break;
            }
            if (
                !sameNodeShape(node, state) ||
                (node.nodeType === 'Text' && (node as XmlTextNode).textContent !== state.expectedText)
            ) {
                this.invalidate();
                break;
            }
            const attrs = (node as XmlNode & { attributes?: Record<string, string> }).attributes ?? {};
            const expected = state.expectedAttributes ?? {};
            if (Object.keys(attrs).some(key => attrs[key] !== expected[key])) {
                this.invalidate();
                break;
            }
            if (state.origin) {
                result.origins.push(state.origin);
                result.attributes.push({
                    origin: state.origin,
                    names: Object.keys(attrs)
                        .filter(key => state.sourceAttributeNames?.includes(key))
                        .sort()
                });
            }
            this.receiptBytes +=
                128 +
                (state.ancestry?.length ?? 0) * 64 +
                state.intervals.reduce((size, span) => size + 80 + (span.ancestry?.length ?? 0) * 64, 0) +
                Object.keys(attrs).reduce((size, key) => size + key.length * 6 + 16, 0);
            if (this.receiptBytes > DELIVERY_TRACE_LIMITS.receiptBytes) {
                this.invalidate('deliveryScope.proofLimit');
                break;
            }
            result.text.push(...state.intervals.filter(span => span.origin !== 0));
            for (const ancestor of [...(state.ancestry ?? []), ...state.intervals.flatMap(span => span.ancestry ?? [])])
                instances.set(`${ancestor.evaluationId}:${ancestor.iteration}`, ancestor);
            for (const span of state.intervals)
                if (span.contribution && span.end > span.start) contributions.add(span.contribution);
            pending.push(...(node.childNodes ?? []).slice().reverse());
        }
        result.contributions = [...contributions];
        result.instances = [...instances.values()];
        if (!this.diagnostic) this.collected.push(result);
    }

    result(): DeliveryTraceResult {
        if (this.collected.length !== this.roots.size) this.invalidate();
        const delivered = new Set(this.collected.flatMap(part => part.contributions));
        return {
            schemaVersion: 1,
            scope: 'xml-origin-trace',
            authoringReady: false,
            valid: !this.diagnostic,
            diagnostic: this.diagnostic,
            containers: this.diagnostic ? [] : this.containers,
            contributions: this.diagnostic ? [] : this.evaluationRecords.filter(record => delivered.has(record.id)),
            parts: this.diagnostic ? [] : this.collected
        };
    }
}

function sameNodeShape(node: XmlNode, state: NodeState): boolean {
    return (
        node.nodeType === state.nodeType &&
        node.nodeName === state.nodeName &&
        (node.nodeType === 'General' || !node.childNodes?.length)
    );
}
function requireNodeShape(node: XmlNode, state: NodeState): boolean {
    if (sameNodeShape(node, state)) return true;
    state.owner.invalidate();
    return false;
}

/** Capture and validate before mutation; later operations cannot bless stale origins. */
export function traceBeforeMutation(node: XmlNode): NodeState | undefined {
    const state = states.get(node);
    if (!state) return undefined;
    const attributes = (node as XmlNode & { attributes?: Record<string, string> }).attributes ?? {};
    if (
        !sameNodeShape(node, state) ||
        (node.nodeType === 'Text' &&
            ((node as XmlTextNode).textContent !== state.expectedText ||
                state.intervals.reduce((length, span) => length + span.end - span.start, 0) !==
                    state.expectedText?.length)) ||
        Object.keys(attributes).some(key => attributes[key] !== state.expectedAttributes?.[key])
    ) {
        state.owner.invalidate();
        return undefined;
    }
    return {
        ...state,
        intervals: state.intervals.map(span => ({ ...span })),
        expectedAttributes: { ...state.expectedAttributes }
    };
}

export function traceClone(original: XmlNode, clone: XmlNode): void {
    const state = traceBeforeMutation(original);
    if (!state || !requireNodeShape(clone, state) || !state.owner.event(state.intervals.length)) return;
    states.set(clone, {
        ...state,
        intervals: state.intervals.map(span => ({ ...span })),
        expectedAttributes: { ...state.expectedAttributes }
    });
}

function sliceIntervals(intervals: OriginInterval[], start: number, end: number): OriginInterval[] {
    const result: OriginInterval[] = [];
    let offset = 0;
    for (const span of intervals) {
        const length = span.end - span.start;
        const left = Math.max(start, offset);
        const right = Math.min(end, offset + length);
        if (left < right) result.push({ ...span, start: span.start + left - offset, end: span.start + right - offset });
        offset += length;
    }
    return result;
}

export function traceSplit(state: NodeState | undefined, first: XmlTextNode, second: XmlTextNode, index: number): void {
    if (!state || !requireNodeShape(first, state) || !requireNodeShape(second, state)) return;
    const length = state.expectedText?.length ?? 0;
    if (
        !Number.isInteger(index) ||
        index < 0 ||
        index > length ||
        first.textContent !== state.expectedText!.slice(0, index) ||
        second.textContent !== state.expectedText!.slice(index)
    ) {
        state.owner.invalidate();
        return;
    }
    if (!state.owner.event(state.intervals.length * 2)) return;
    const source = state.intervals;
    states.set(first, { ...state, expectedText: first.textContent, intervals: sliceIntervals(source, 0, index) });
    states.set(second, {
        ...state,
        expectedText: second.textContent,
        intervals: sliceIntervals(source, index, length)
    });
}

export function traceJoin(target: XmlTextNode, found: (NodeState | undefined)[]): void {
    const state = found.find(Boolean);
    if (!state || !requireNodeShape(target, state)) return;
    if (found.some(item => !item || item.owner !== state.owner)) {
        state.owner.invalidate();
        return;
    }
    if (target.textContent !== found.map(item => item!.expectedText).join('')) {
        state.owner.invalidate();
        return;
    }
    const intervals = found.flatMap(item => item!.intervals);
    if (!state.owner.event(intervals.length)) return;
    states.set(target, { ...state, intervals, expectedText: target.textContent });
}

export function traceRegisterTag(tag: Tag): void {
    const state = traceBeforeMutation(tag.xmlTextNode);
    if (state) state.owner.registerTag(tag, state);
}

export function traceBeginEvaluation(node: XmlNode): DeliveryEvaluation | undefined {
    const state = traceBeforeMutation(node);
    return state?.owner.beginEvaluation(state);
}

export function traceGeneratedText(
    node: XmlTextNode,
    state: NodeState | undefined,
    evaluation?: DeliveryEvaluation
): void {
    if (!state || !requireNodeShape(node, state) || !state.owner.event()) return;
    const binding = evaluation && evaluations.get(evaluation);
    if (evaluation && (!binding || binding.owner !== state.owner)) {
        state.owner.invalidate();
        return;
    }
    states.set(node, {
        ...state,
        expectedText: node.textContent,
        intervals: [
            {
                origin: 0,
                start: 0,
                end: node.textContent.length,
                ...(binding ? { contribution: binding.record.id } : {}),
                ...(state.ancestry ? { ancestry: state.ancestry } : {})
            }
        ]
    });
}

export function traceAttribute(node: XmlNode, name: string, state: NodeState | undefined): void {
    if (!state || !requireNodeShape(node, state) || !state.owner.event()) return;
    // A generated attribute must not be represented as surviving source data.
    const attributes = (node as XmlNode & { attributes?: Record<string, string> }).attributes ?? {};
    state.expectedAttributes = { ...state.expectedAttributes, [name]: attributes[name] };
    state.sourceAttributeNames = state.sourceAttributeNames?.filter(key => key !== name);
    states.set(node, state);
}

/** Declare plugin-created nodes as generated, preserving tracked descendants. */
export function traceGeneratedTree(root: XmlNode, anchor: ReturnType<typeof traceBeforeMutation>): void {
    if (!anchor) return;
    const pending = [root];
    while (pending.length) {
        const node = pending.pop()!;
        if (!anchor.owner.event()) return;
        const existing = states.get(node);
        if (existing) {
            if (existing.owner !== anchor.owner) {
                anchor.owner.invalidate();
                return;
            }
            traceBeforeMutation(node);
        } else {
            const value = node.nodeType === 'Text' ? (node as XmlTextNode).textContent : undefined;
            if (node.nodeType === 'Comment') {
                anchor.owner.invalidate('deliveryScope.unsupportedComment');
                return;
            }
            states.set(node, {
                owner: anchor.owner,
                part: anchor.part,
                ancestry: anchor.ancestry,
                origin: 0,
                nodeType: node.nodeType,
                nodeName: node.nodeName,
                intervals: value === undefined ? [] : [{ origin: 0, start: 0, end: value.length }],
                expectedText: value,
                expectedAttributes: { ...(node as XmlNode & { attributes?: Record<string, string> }).attributes },
                sourceAttributeNames: []
            });
        }
        pending.push(...(node.childNodes ?? []).slice().reverse());
    }
}

export function traceContainerDecision(
    open: XmlNode,
    close: XmlNode,
    evaluation: DeliveryEvaluation | undefined,
    count: number,
    condition: boolean
): void {
    const openState = traceBeforeMutation(open),
        closeState = traceBeforeMutation(close);
    if (openState && closeState && evaluation)
        openState.owner.recordContainer(openState, closeState, evaluation, count, condition);
}

export function traceRepeatInstance(
    root: XmlNode,
    evaluation: DeliveryEvaluation | undefined,
    iteration: number
): void {
    if (!evaluation) return;
    const binding = evaluations.get(evaluation);
    if (!binding) return;
    const pending = [root];
    while (pending.length) {
        const node = pending.pop()!;
        const state = traceBeforeMutation(node);
        if (!state || state.owner !== binding.owner) {
            binding.owner.invalidate();
            return;
        }
        if (!state.owner.event(state.intervals.length)) return;
        const ancestry = [...(state.ancestry ?? []), { evaluationId: evaluation.id, iteration }];
        if (ancestry.length > DELIVERY_TRACE_LIMITS.depth) {
            binding.owner.invalidate('deliveryScope.proofLimit');
            return;
        }
        states.set(node, {
            ...state,
            ancestry,
            intervals: state.intervals.map(span => ({
                ...span,
                ancestry: [...(span.ancestry ?? []), { evaluationId: evaluation.id, iteration }]
            }))
        });
        pending.push(...(node.childNodes ?? []));
    }
}
