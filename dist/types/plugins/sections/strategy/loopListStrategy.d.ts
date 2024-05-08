import type { Tag } from "../../../compilation";
import { XmlNode } from "../../../xml";
import type { PluginUtilities } from "../../templatePlugin";
import type { ILoopStrategy, SplitBeforeResult } from "./iLoopStrategy";
export declare class LoopListStrategy implements ILoopStrategy {
    private utilities;
    setUtilities(utilities: PluginUtilities): void;
    isApplicable(openTag: Tag, closeTag: Tag): boolean;
    splitBefore(openTag: Tag, closeTag: Tag): SplitBeforeResult;
    mergeBack(paragraphGroups: XmlNode[][], firstParagraph: XmlNode, lastParagraphs: XmlNode): void;
}
