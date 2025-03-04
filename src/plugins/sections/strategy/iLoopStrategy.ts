import type { Tag } from '../../../compilation';
import type { XmlNode } from '../../../xml';
import type { PluginUtilities } from '../../templatePlugin';

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
