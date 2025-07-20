import { Docx, XmlPart } from '../office/index.js';

export interface TemplateContext {
    docx: Docx;
    currentPart: XmlPart;
}
