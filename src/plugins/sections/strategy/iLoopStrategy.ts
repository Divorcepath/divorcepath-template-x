import type { Tag } from '../../../compilation/index.ts';
import type { XmlNode } from '../../../xml/index.ts';
import type { PluginUtilities } from '../../templatePlugin.ts';

export interface Section {
    id?: string;
    name?: string;
    hidden?: boolean;
    hideMode: 'hidable' | 'excludable';
    lock?: boolean;
    appearance?: 'hidden' | 'boundingBox';
}

export interface ILoopStrategy {
    setUtilities(utilities: PluginUtilities): void;

    isApplicable(openTag: Tag, closeTag: Tag): boolean;

    splitBefore(openTag: Tag, closeTag: Tag): SplitBeforeResult;

    mergeBack(compiledNodes: XmlNode[][], firstNode: XmlNode, lastNode: XmlNode, section: Section): void;
}

export interface SplitBeforeResult {
    firstNode: XmlNode;
    nodesToRepeat: XmlNode[];
    lastNode: XmlNode;
}
