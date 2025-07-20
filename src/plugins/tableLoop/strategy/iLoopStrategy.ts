import { Tag } from '../../../compilation/index.js';
import { XmlNode } from '../../../xml/index.js';
import { PluginUtilities } from '../../templatePlugin.js';

export interface ILoopStrategy {
    setUtilities(utilities: PluginUtilities): void;

    isApplicable(openTag: Tag, closeTag: Tag): boolean;

    splitBefore(openTag: Tag, closeTag: Tag): SplitBeforeResult;

    mergeBack(compiledNodes: XmlNode[][], firstNode: XmlNode, lastNode: XmlNode): void;
}

export interface SplitBeforeResult {
    firstNode: XmlNode;
    nodesToRepeat: XmlNode[];
    lastNode: XmlNode;
}
