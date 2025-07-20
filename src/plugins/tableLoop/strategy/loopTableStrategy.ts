import { Tag } from '../../../compilation/index.js';
import { XmlNode } from '../../../xml/index.js';
import { PluginUtilities } from '../../templatePlugin.js';
import { ILoopStrategy, SplitBeforeResult } from './iLoopStrategy.js';

export class LoopTableStrategy implements ILoopStrategy {
    private utilities: PluginUtilities;

    public setUtilities(utilities: PluginUtilities): void {
        this.utilities = utilities;
    }

    public isApplicable(openTag: Tag, closeTag: Tag): boolean {
        const containingParagraph = this.utilities.docxParser.containingParagraphNode(openTag.xmlTextNode);
        if (!containingParagraph.parentNode) return false;
        return this.utilities.docxParser.isTableCellNode(containingParagraph.parentNode);
    }

    public splitBefore(openTag: Tag, closeTag: Tag): SplitBeforeResult {
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
    }

    public mergeBack(rowGroups: XmlNode[][], firstRow: XmlNode, lastRow: XmlNode): void {
        for (const curRowsGroup of rowGroups) {
            for (const row of curRowsGroup) {
                XmlNode.insertBefore(row, lastRow);
            }
        }

        // remove the old rows
        XmlNode.remove(firstRow);
        if (firstRow !== lastRow) {
            XmlNode.remove(lastRow);
        }
    }
}
