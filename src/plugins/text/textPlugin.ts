import {
    traceGeneratedText,
    traceBeforeMutation,
    traceGeneratedTree,
    type DeliveryEvaluation
} from '../../provenance/deliveryTrace.js';
import { ScopeData, Tag } from '../../compilation/index.js';
import { DocxParser } from '../../office/index.js';
import { stringValue } from '../../utils/index.js';
import { XmlNode, XmlTextNode } from '../../xml/index.js';
import { TemplatePlugin } from '../templatePlugin.js';

export const TEXT_CONTENT_TYPE = 'text';

export class TextPlugin extends TemplatePlugin {
    public readonly contentType = TEXT_CONTENT_TYPE;

    /**
     * Replace the node text content with the specified value.
     */
    public simpleTagReplacements(tag: Tag, data: ScopeData): void {
        const { value, evaluation } = data.getScopeDataForDelivery(tag.xmlTextNode);
        const lines = stringValue(value).split('\n');

        if (lines.length < 2) {
            this.replaceSingleLine(tag.xmlTextNode, lines.length ? lines[0] : '', evaluation);
        } else {
            this.replaceMultiLine(tag.xmlTextNode, lines, evaluation);
        }
    }

    private replaceSingleLine(textNode: XmlTextNode, text: string, evaluation?: DeliveryEvaluation) {
        // set text
        const originBefore = traceBeforeMutation(textNode);
        textNode.textContent = text;
        traceGeneratedText(textNode, originBefore, evaluation);

        // make sure leading and trailing whitespace are preserved
        const wordTextNode = this.utilities.docxParser.containingTextNode(textNode);
        this.utilities.docxParser.setSpacePreserveAttribute(wordTextNode);
    }

    private replaceMultiLine(textNode: XmlTextNode, lines: string[], evaluation?: DeliveryEvaluation) {
        const runNode = this.utilities.docxParser.containingRunNode(textNode);

        // first line
        const originBefore = traceBeforeMutation(textNode);
        textNode.textContent = lines[0];
        traceGeneratedText(textNode, originBefore, evaluation);

        // other lines
        for (let i = 1; i < lines.length; i++) {
            // add line break
            const lineBreak = this.getLineBreak();
            traceGeneratedTree(lineBreak, originBefore);
            XmlNode.appendChild(runNode, lineBreak);

            // add text
            const lineNode = this.createWordTextNode(lines[i]);
            traceGeneratedTree(lineNode, originBefore);
            const generatedText = lineNode.childNodes[0] as XmlTextNode;
            traceGeneratedText(generatedText, traceBeforeMutation(generatedText), evaluation);
            XmlNode.appendChild(runNode, lineNode);
        }
    }

    private getLineBreak(): XmlNode {
        return XmlNode.createGeneralNode('w:br');
    }

    private createWordTextNode(text: string): XmlNode {
        const wordTextNode = XmlNode.createGeneralNode(DocxParser.TEXT_NODE);

        wordTextNode.attributes = {};
        this.utilities.docxParser.setSpacePreserveAttribute(wordTextNode);

        wordTextNode.childNodes = [XmlNode.createTextNode(text)];

        return wordTextNode;
    }
}
