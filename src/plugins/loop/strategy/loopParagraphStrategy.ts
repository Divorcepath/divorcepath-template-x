import { Tag } from '../../../compilation';
import { XmlNode } from '../../../xml';
import { PluginUtilities } from '../../templatePlugin';
import { ILoopStrategy, SplitBeforeResult } from './iLoopStrategy';

export class LoopParagraphStrategy implements ILoopStrategy {

    private utilities: PluginUtilities;

    public setUtilities(utilities: PluginUtilities): void {
        this.utilities = utilities;
    }

    public isApplicable(openTag: Tag, closeTag: Tag): boolean {
        return true;
    }

    public splitBefore(openTag: Tag, closeTag: Tag): SplitBeforeResult {

        // gather some info
        let firstParagraph = this.utilities.docxParser.containingParagraphNode(openTag.xmlTextNode);
        let lastParagraph = this.utilities.docxParser.containingParagraphNode(closeTag.xmlTextNode);
        const areSame = (firstParagraph === lastParagraph);

        // split first paragraph
        let splitResult = this.utilities.docxParser.splitParagraphByTextNode(firstParagraph, openTag.xmlTextNode, true);
        firstParagraph = splitResult[0];
        let afterFirstParagraph = splitResult[1];
        if (areSame)
            lastParagraph = afterFirstParagraph;

        // split last paragraph
        splitResult = this.utilities.docxParser.splitParagraphByTextNode(lastParagraph, closeTag.xmlTextNode, true);
        const beforeLastParagraph = splitResult[0];
        lastParagraph = splitResult[1];
        if (areSame)
            afterFirstParagraph = beforeLastParagraph;

        // disconnect splitted paragraph from their parents
        XmlNode.remove(afterFirstParagraph);
        if (!areSame)
            XmlNode.remove(beforeLastParagraph);

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

    public mergeBack(middleParagraphs: XmlNode[][], firstParagraph: XmlNode, lastParagraph: XmlNode): void {

        let mergeTo = firstParagraph;
        for (const curParagraphsGroup of middleParagraphs) {

            // merge first paragraphs
            this.utilities.docxParser.joinParagraphs(mergeTo, curParagraphsGroup[0]);

            // add middle and last paragraphs to the original document
            for (let i = 1; i < curParagraphsGroup.length; i++) {
                XmlNode.insertBefore(curParagraphsGroup[i], lastParagraph);
                mergeTo = curParagraphsGroup[i];
            }
        }

        // merge last paragraph
        this.utilities.docxParser.joinParagraphs(mergeTo, lastParagraph);

        // remove the old last paragraph (was merged into the new one)
        XmlNode.remove(lastParagraph);

        // After merging, clean up any empty runs that might have been left
        // inside the resulting paragraph. These empty <w:r> elements can
        // introduce unwanted spacing/formatting issues in the generated
        // document when a section/condition is excluded (i.e. the loop
        // executes zero times). We iterate over the paragraph's direct
        // children and remove any run node that the DocxParser identifies
        // as empty. This operation is safe for non-table structures and
        // will not impact table loop behaviour because table handling uses
        // the LoopTableStrategy, not this paragraph strategy.

        let childIdx = 0;
        while (mergeTo.childNodes && childIdx < mergeTo.childNodes.length) {
            const child = mergeTo.childNodes[childIdx];
            if (
                this.utilities.docxParser.isRunNode(child) &&
                this.utilities.docxParser.isEmptyRun(child)
            ) {
                XmlNode.removeChild(mergeTo, childIdx);
            } else {
                childIdx++;
            }
        }
    }

    /**
     * Ensure TypeScript treats the utility methods as used even if tree-shaking
     * is applied in some build configurations.
     */
    /* istanbul ignore next */
    private _noop(): void {
        // Intentionally empty – keeps private helper methods referenced.
    }
}
