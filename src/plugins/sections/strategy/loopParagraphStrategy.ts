import { Tag } from "../../../compilation";
import { XmlNode } from "../../../xml";
import { PluginUtilities } from "../../templatePlugin";
import { ILoopStrategy, Section, SplitBeforeResult } from "./iLoopStrategy";

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
        let firstParagraph = this.utilities.docxParser.containingParagraphNode(
            openTag.xmlTextNode
        );
        let lastParagraph = this.utilities.docxParser.containingParagraphNode(
            closeTag.xmlTextNode
        );
        const areSame = firstParagraph === lastParagraph;

        // split first paragraph
        let splitResult = this.utilities.docxParser.splitParagraphByTextNode(
            firstParagraph,
            openTag.xmlTextNode,
            true
        );
        firstParagraph = splitResult[0];
        let afterFirstParagraph = splitResult[1];
        if (areSame) lastParagraph = afterFirstParagraph;

        // split last paragraph
        splitResult = this.utilities.docxParser.splitParagraphByTextNode(
            lastParagraph,
            closeTag.xmlTextNode,
            true
        );
        const beforeLastParagraph = splitResult[0];
        lastParagraph = splitResult[1];
        if (areSame) afterFirstParagraph = beforeLastParagraph;

        // disconnect splitted paragraph from their parents
        XmlNode.remove(afterFirstParagraph);
        if (!areSame) XmlNode.remove(beforeLastParagraph);

        // extract all paragraphs in between
        let middleParagraphs: XmlNode[];
        if (areSame) {
            middleParagraphs = [afterFirstParagraph];
        } else {
            const inBetween = XmlNode.removeSiblings(
                firstParagraph,
                lastParagraph
            );
            middleParagraphs = [afterFirstParagraph].concat(inBetween);

            if (
                beforeLastParagraph.nodeName !== "w:p" ||
                beforeLastParagraph.childNodes.length > 0
            ) {
                middleParagraphs.push(beforeLastParagraph);
            }
        }

        return {
            firstNode: firstParagraph,
            nodesToRepeat: middleParagraphs,
            lastNode: lastParagraph,
        };
    }

    public mergeBack(
        middleParagraphs: XmlNode[][],
        firstParagraph: XmlNode,
        lastParagraph: XmlNode,
        section: Section
    ): void {
        const { name, id: bookmarkId, include } = section;
        let mergeTo = firstParagraph;

        const bookmarkStart = XmlNode.createGeneralNode("w:bookmarkStart");
        bookmarkStart.attributes = {};

        bookmarkStart.attributes["w:id"] = bookmarkId;
        bookmarkStart.attributes["w:name"] = name ?? `sectionId_${bookmarkId}`;

        const bookmarkEnd = XmlNode.createGeneralNode("w:bookmarkEnd");
        bookmarkEnd.attributes = {};
        bookmarkEnd.attributes["w:id"] = bookmarkId;

        XmlNode.insertBefore(bookmarkStart, mergeTo);

        for (const curParagraphsGroup of middleParagraphs) {
            // merge first paragraphs
            this.utilities.docxParser.joinParagraphs(
                mergeTo,
                curParagraphsGroup[0]
            );

            // add middle and last paragraphs to the original document
            for (let i = 1; i < curParagraphsGroup.length; i++) {
                XmlNode.insertBefore(curParagraphsGroup[i], lastParagraph);
                mergeTo = curParagraphsGroup[i];
            }
        }

        // merge last paragraph
        // this.utilities.docxParser.joinParagraphs(mergeTo, lastParagraph);

        // remove the old last paragraph (was merged into the new one)

        XmlNode.insertAfter(bookmarkEnd, mergeTo);

        if (
            (firstParagraph.nodeName === "w:p" &&
                firstParagraph.childNodes.length === 0) ||
            include === false
        ) {
            XmlNode.remove(firstParagraph);
        }

        XmlNode.remove(lastParagraph);
    }
}
