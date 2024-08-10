import { ScopeData, Tag } from '../../compilation';
import { DocxParser } from '../../office';
import { stringValue } from '../../utils';
import { XmlNode, XmlTextNode } from '../../xml';
import { TemplatePlugin } from '../templatePlugin';

export const TEXT_CONTENT_TYPE = 'text';

export class TextPlugin extends TemplatePlugin {
    public readonly contentType = TEXT_CONTENT_TYPE;

    public simpleTagReplacements(tag: Tag, data: ScopeData): void {
        const value = data.getScopeData();
        
        if (this.isCheckbox(tag.xmlTextNode)) {
            this.replaceCheckbox(tag.xmlTextNode, Boolean(value));
        } else {
            const lines = stringValue(value).split('\n');
            if (lines.length < 2) {
                this.replaceSingleLine(tag.xmlTextNode, lines.length ? lines[0] : '');
            } else {
                this.replaceMultiLine(tag.xmlTextNode, lines);
            }
        }
    }

    private isCheckbox(textNode: XmlTextNode): boolean {
        const runNode = this.utilities.docxParser.containingRunNode(textNode);
        return Boolean(runNode.querySelector('w14:checkbox'));
    }

    private replaceCheckbox(textNode: XmlTextNode, checked: boolean): void {
        const runNode = this.utilities.docxParser.containingRunNode(textNode);
        const checkbox = runNode.querySelector('w14:checkbox');
        if (checkbox) {
            const checkedAttr = checkbox.querySelector('w14:checked');
            if (checkedAttr) {
                checkedAttr.setAttribute('w14:val', checked ? '1' : '0');
            }
        }
        
        // Remove empty runs within the checkbox
        this.removeEmptyRuns(runNode);
        
        // Update the checkbox symbol
        textNode.textContent = checked ? '☑' : '☐';
    }

    private removeEmptyRuns(runNode: XmlNode): void {
        const paragraphNode = runNode.parentNode;
        if (paragraphNode) {
            const runs = Array.from(paragraphNode.querySelectorAll('w:r'));
            for (const run of runs) {
                if (this.isEmptyRun(run)) {
                    paragraphNode.removeChild(run);
                }
            }
        }
    }

    private isEmptyRun(run: XmlNode): boolean {
        const textNodes = run.querySelectorAll('w:t');
        return textNodes.length === 0 || textNodes.every(node => node.textContent.trim() === '');
    }

    private replaceSingleLine(textNode: XmlTextNode, text: string) {
        // set text
        textNode.textContent = text;
        // make sure leading and trailing whitespace are preserved
        const wordTextNode = this.utilities.docxParser.containingTextNode(textNode);
        this.utilities.docxParser.setSpacePreserveAttribute(wordTextNode);
    }

    private replaceMultiLine(textNode: XmlTextNode, lines: string[]) {
        const runNode = this.utilities.docxParser.containingRunNode(textNode);
        // first line
        textNode.textContent = lines[0];
        // other lines
        for (let i = 1; i < lines.length; i++) {
            // add line break
            const lineBreak = this.getLineBreak();
            XmlNode.appendChild(runNode, lineBreak);
            // add text
            const lineNode = this.createWordTextNode(lines[i]);
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
        wordTextNode.childNodes = [
            XmlNode.createTextNode(text)
        ];
        return wordTextNode;
    }
}