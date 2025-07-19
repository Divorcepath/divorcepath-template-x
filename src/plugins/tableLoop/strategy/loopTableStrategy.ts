import { Tag } from '../../../compilation';
import { XmlNode } from '../../../xml';
import { PluginUtilities } from '../../templatePlugin';
import { LoopOver, LoopTagOptions } from '../loopTagOptions';
import { ILoopStrategy, SplitBeforeResult } from './iLoopStrategy';

export class LoopTableStrategy implements ILoopStrategy {
    private utilities: PluginUtilities;

    public setUtilities(utilities: PluginUtilities): void {
        this.utilities = utilities;
    }

    private isRowLoop(openTag: Tag, closeTag: Tag, options: LoopTagOptions): boolean {
        const openParagraph = this.utilities.docxParser.containingParagraphNode(openTag.xmlTextNode);
        const closeParagraph = this.utilities.docxParser.containingParagraphNode(closeTag.xmlTextNode);

        // Explicit override
        if (options?.loopOver === LoopOver.Row) return true;
        if (options?.loopOver === LoopOver.Content) return false;

        // Default heuristic – if tags are in the same cell, treat as content loop.
        return openParagraph.parentNode !== closeParagraph.parentNode;
    }

    // flag to share row/content decision between splitBefore and mergeBack
    private _rowLoopDecision = new WeakMap<Tag, boolean>();

    public isApplicable(openTag: Tag, closeTag: Tag): boolean {
        const openParagraph = this.utilities.docxParser.containingParagraphNode(openTag.xmlTextNode);
        if (!openParagraph?.parentNode) return false;
        return this.utilities.docxParser.isTableCellNode(openParagraph.parentNode);
    }

    public splitBefore(openTag: Tag, closeTag: Tag): SplitBeforeResult {
        const options = openTag.options as LoopTagOptions;
        const isRowLoop = this.isRowLoop(openTag, closeTag, options);
        this._rowLoopDecision.set(openTag, isRowLoop);

        if (isRowLoop) {
            // ===== Row loop (existing behaviour) =====
            const firstRow = this.utilities.docxParser.containingTableRowNode(openTag.xmlTextNode);
            const lastRow = this.utilities.docxParser.containingTableRowNode(closeTag.xmlTextNode);
            const rowsToRepeat = XmlNode.siblingsInRange(firstRow, lastRow);

            // remove the loop tags
            XmlNode.remove(openTag.xmlTextNode);
            XmlNode.remove(closeTag.xmlTextNode);

            return {
                firstNode: firstRow,
                nodesToRepeat: rowsToRepeat,
                lastNode: lastRow
            };
        } else {
            // ===== Content loop (paragraph-level) =====
            // Based on LoopParagraphStrategy implementation.
            // gather some info
            let firstParagraph = this.utilities.docxParser.containingParagraphNode(openTag.xmlTextNode);
            let lastParagraph = this.utilities.docxParser.containingParagraphNode(closeTag.xmlTextNode);
            const areSame = firstParagraph === lastParagraph;

            // split first paragraph
            let splitResult = this.utilities.docxParser.splitParagraphByTextNode(firstParagraph, openTag.xmlTextNode, true);
            firstParagraph = splitResult[0];
            let afterFirstParagraph = splitResult[1];
            if (areSame) lastParagraph = afterFirstParagraph;

            // split last paragraph
            splitResult = this.utilities.docxParser.splitParagraphByTextNode(lastParagraph, closeTag.xmlTextNode, true);
            const beforeLastParagraph = splitResult[0];
            lastParagraph = splitResult[1];
            if (areSame) afterFirstParagraph = beforeLastParagraph;

            // disconnect splitted paragraphs from their parents
            XmlNode.remove(afterFirstParagraph);
            if (!areSame) XmlNode.remove(beforeLastParagraph);

            // extract all paragraphs in between
            let middleParagraphs: XmlNode[];
            if (areSame) {
                middleParagraphs = [afterFirstParagraph];
            } else {
                const inBetween = XmlNode.removeSiblings(firstParagraph, lastParagraph);
                middleParagraphs = [afterFirstParagraph].concat(inBetween).concat(beforeLastParagraph);
            }

            return {
                firstNode: firstParagraph,
                nodesToRepeat: middleParagraphs,
                lastNode: lastParagraph
            };
        }
    }

    public mergeBack(nodeGroups: XmlNode[][], firstNode: XmlNode, lastNode: XmlNode): void {
        // Determine if this was a row loop by checking stored flag using first child tag (not ideal but works)
        // We assume firstNode still has a preceding open tag reference in _rowLoopDecision map keys (rare case). If not found, fallback heuristic.
        let isRowLoop = true;
        try {
            // WeakMap keys are tags; we don't have the tag here, so derive by node type heuristic: table row nodeName 'w:tr'
            isRowLoop = firstNode.nodeName === 'w:tr';
        } catch {}

        if (isRowLoop) {
            // ===== Row loop merge =====
            for (const curRowsGroup of nodeGroups) {
                for (const row of curRowsGroup) {
                    XmlNode.insertBefore(row, lastNode);
                }
            }

            // remove the old rows (placeholders)
            XmlNode.remove(firstNode);
            if (firstNode !== lastNode) {
                XmlNode.remove(lastNode);
            }
        } else {
            // ===== Content loop merge (paragraph-level) =====
            let mergeTo = firstNode;
            for (const curParagraphsGroup of nodeGroups) {
                // merge first paragraphs
                this.utilities.docxParser.joinParagraphs(mergeTo, curParagraphsGroup[0]);

                // add middle and last paragraphs to the original document
                for (let i = 1; i < curParagraphsGroup.length; i++) {
                    XmlNode.insertBefore(curParagraphsGroup[i], lastNode);
                    mergeTo = curParagraphsGroup[i];
                }
            }

            // merge last paragraph
            this.utilities.docxParser.joinParagraphs(mergeTo, lastNode);

            // remove the old last paragraph (was merged into the new one)
            XmlNode.remove(lastNode);
        }
    }
}
