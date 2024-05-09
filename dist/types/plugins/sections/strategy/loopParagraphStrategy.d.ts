import type { Tag } from "../../../compilation";
import { XmlNode } from "../../../xml";
import type { PluginUtilities } from "../../templatePlugin";
import type { ILoopStrategy, Section, SplitBeforeResult } from "./iLoopStrategy";
export declare class LoopParagraphStrategy implements ILoopStrategy {
    private utilities;
    setUtilities(utilities: PluginUtilities): void;
    isApplicable(openTag: Tag, closeTag: Tag): boolean;
    splitBefore(openTag: Tag, closeTag: Tag): SplitBeforeResult;
    mergeBack(middleParagraphs: XmlNode[][], firstParagraph: XmlNode, lastParagraph: XmlNode, section: Section): void;
    private vanishParagraph;
    private vanishRun;
    private vanishSdtPr;
    private vanishTableRow;
}
