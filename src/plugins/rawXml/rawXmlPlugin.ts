import { ScopeData, Tag } from '../../compilation/index.js';
import { XmlNode } from '../../xml/index.js';
import { TemplatePlugin } from '../templatePlugin.js';
import { RawXmlContent } from './rawXmlContent.js';

export class RawXmlPlugin extends TemplatePlugin {

    public readonly contentType = 'rawXml';

    public simpleTagReplacements(tag: Tag, data: ScopeData): void {

        const value = data.getScopeData<RawXmlContent>();

        const replaceNode = value?.replaceParagraph ?
            this.utilities.docxParser.containingParagraphNode(tag.xmlTextNode) :
            this.utilities.docxParser.containingTextNode(tag.xmlTextNode);

        if (typeof value?.xml === 'string') {
            const newNode = this.utilities.xmlParser.parse(value.xml);
            XmlNode.insertBefore(newNode, replaceNode);
        }

        XmlNode.remove(replaceNode);
    }
}
