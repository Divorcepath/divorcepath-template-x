import type { Tag } from '../../../compilation';
import { XmlNode, XmlParser } from '../../../xml';
import type { PluginUtilities } from '../../templatePlugin';
import type { ILoopStrategy, Section, SplitBeforeResult } from './iLoopStrategy';

const getRandomInt = (min: number, max: number) => {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
};

const genererateContentControlId = () => getRandomInt(1_000, 1_000_000_000);

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

        // disconnect splitted paragraph from their parents
        XmlNode.remove(afterFirstParagraph);
        if (!areSame) XmlNode.remove(beforeLastParagraph);

        // extract all paragraphs in between
        let middleParagraphs: XmlNode[];
        if (areSame) {
            middleParagraphs = [afterFirstParagraph];
        } else {
            const inBetween = XmlNode.removeSiblings(firstParagraph, lastParagraph);
            middleParagraphs = [afterFirstParagraph].concat(inBetween);

            if (beforeLastParagraph.nodeName !== 'w:p' || beforeLastParagraph.childNodes.length > 0) {
                middleParagraphs.push(beforeLastParagraph);
            }
        }

        return {
            firstNode: firstParagraph,
            nodesToRepeat: middleParagraphs,
            lastNode: lastParagraph
        };
    }

    public mergeBack(
        middleParagraphs: XmlNode[][],
        firstParagraph: XmlNode,
        lastParagraph: XmlNode,
        section: Section
    ): void {
        const { name, id, hidden = false, appearance = 'hidden', lock = false } = section;

        const tag = name;

        const sdtTemplate = `
            <w:sdt>
                <w:sdtPr>
                    <w:id w:val="${id ?? genererateContentControlId()}" />
                     <w:tag w:val="${tag}"/>
                     <w15:appearance w15:val="${appearance}"/>
                      ${lock ? `<w:lock w:val="sdtLocked" />` : ''}
                </w:sdtPr>
                <w:sdtContent>
                </w:sdtContent>
            </w:sdt>
        `;

        const sdtNode = new XmlParser().parse(sdtTemplate);
        const sdtContent = XmlNode.findChildByName(sdtNode, 'w:sdtContent');

        for (const curParagraphsGroup of middleParagraphs) {
            // Add middle and last paragraphs to the sdtContent
            for (let i = 0; i < curParagraphsGroup.length; i++) {
                XmlNode.appendChild(sdtContent, curParagraphsGroup[i]);
            }
        }

        XmlNode.insertBefore(sdtNode, lastParagraph);

        XmlNode.remove(lastParagraph);
        XmlNode.remove(firstParagraph);

        if (hidden) {
            this.vanishNode(sdtContent);
        }
    }

    private vanishNode(node: XmlNode): void {
        const pCollection = XmlNode.findChildrenByNameDeep(node, 'w:p');
        const rCollection = XmlNode.findChildrenByNameDeep(node, 'w:r');
        const sdtPrCollection = XmlNode.findChildrenByNameDeep(node, 'w:sdtPr');
        const trCollection = XmlNode.findChildrenByNameDeep(node, 'w:tr');

        Array.from(pCollection).forEach(p => {
            this.vanishParagraph(p);
        });

        Array.from(rCollection).forEach(wr => {
            this.vanishRun(wr);
        });

        Array.from(sdtPrCollection).forEach(sdtPr => {
            this.vanishSdtPr(sdtPr);
        });

        Array.from(trCollection).forEach(tr => {
            this.vanishTableRow(tr);
        });

        if (node.nodeName === 'w:p') {
            this.vanishParagraph(node);
        }
    }

    private vanishParagraph(p: XmlNode) {
        let pPr = XmlNode.findChildByName(p, 'w:pPr');

        if (!pPr) {
            pPr = XmlNode.createGeneralNode('w:pPr');
            XmlNode.insertChild(p, pPr, 0);
            // p.insertAdjacentElement("afterbegin", pPr);
        }

        let rPr = XmlNode.findChildByName(pPr, 'w:rPr');

        if (!rPr) {
            // create rPr
            rPr = XmlNode.createGeneralNode('w:rPr');
            XmlNode.insertChild(pPr, rPr, 0);
        }

        const vanish = XmlNode.createGeneralNode('w:vanish');

        XmlNode.appendChild(rPr, vanish);
    }

    private vanishRun(wr: XmlNode) {
        let rPr = XmlNode.findChildByName(wr, 'w:rPr');

        if (!rPr) {
            // create rPr
            rPr = XmlNode.createGeneralNode('w:rPr');
            XmlNode.insertChild(wr, rPr, 0);
        }

        const vanish = XmlNode.createGeneralNode('w:vanish');

        XmlNode.appendChild(rPr, vanish);
    }

    private vanishSdtPr(sdtPr: XmlNode) {
        let rPr = XmlNode.findChildByName(sdtPr, 'w:rPr');

        if (!rPr) {
            // create rPr
            rPr = XmlNode.createGeneralNode('w:rPr');
            XmlNode.insertChild(sdtPr, rPr, 0);
        }

        const vanish = XmlNode.createGeneralNode('w:vanish');

        XmlNode.appendChild(rPr, vanish);
    }

    private vanishTableRow(tr: XmlNode) {
        let trPr = XmlNode.findChildByName(tr, 'w:trPr');

        if (!trPr) {
            // create rPr
            trPr = XmlNode.createGeneralNode('w:trPr');
            XmlNode.insertChild(tr, trPr, 0);
        }

        const hidden = XmlNode.createGeneralNode('w:hidden');

        XmlNode.appendChild(trPr, hidden);
    }
}
