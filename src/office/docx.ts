import { MalformedFileError } from '../errors';
import { Constructor, IMap } from '../types';
import { Binary, last } from '../utils';
import { XmlGeneralNode, XmlNode, XmlNodeType, XmlParser } from '../xml';
import { Zip } from '../zip';
import { ContentPartType } from './contentPartType';
import { ContentTypesFile } from './contentTypesFile';
import { MediaFiles } from './mediaFiles';
import { Rels } from './rels';
import { XmlPart } from './xmlPart';

/**
 * Represents a single docx file.
 */
export class Docx {

    private static readonly mainDocumentRelType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';

    //
    // static methods
    //

    public static async open(zip: Zip, xmlParser: XmlParser): Promise<Docx> {
        const mainDocumentPath = await Docx.getMainDocumentPath(zip, xmlParser);
        if (!mainDocumentPath)
            throw new MalformedFileError('docx');

        return new Docx(mainDocumentPath, zip, xmlParser);
    }

    private static async getMainDocumentPath(zip: Zip, xmlParser: XmlParser): Promise<string> {
        const rootPart = '';
        const rootRels = new Rels(rootPart, zip, xmlParser);
        const relations = await rootRels.list();
        return relations.find(rel => rel.type == Docx.mainDocumentRelType)?.target;
    }

    //
    // fields
    //

    public readonly mainDocument: XmlPart;
    public readonly mediaFiles: MediaFiles;
    public readonly contentTypes: ContentTypesFile;

    private readonly _parts: IMap<XmlPart> = {};

    /**
     * **Notice:** You should only use this property if there is no other way to
     * do what you need. Use with caution.
     */
    public get rawZipFile(): Zip {
        return this.zip;
    }

    //
    // constructor
    //

    private constructor(
        mainDocumentPath: string,
        private readonly zip: Zip,
        private readonly xmlParser: XmlParser
    ) {
        this.mainDocument = new XmlPart(mainDocumentPath, zip, xmlParser);
        this.mediaFiles = new MediaFiles(zip);
        this.contentTypes = new ContentTypesFile(zip, xmlParser);
    }

    //
    // public methods
    //

    public async getContentPart(type: ContentPartType): Promise<XmlPart> {
        switch (type) {
            case ContentPartType.MainDocument:
                return this.mainDocument;
            default:
                return await this.getHeaderOrFooter(type);
        }
    }

    /**
     * Returns the xml parts of the main document, headers and footers.
     */
    public async getContentParts(): Promise<XmlPart[]> {
        const partTypes = [
            ContentPartType.MainDocument,
            ContentPartType.DefaultHeader,
            ContentPartType.FirstHeader,
            ContentPartType.EvenPagesHeader,
            ContentPartType.DefaultFooter,
            ContentPartType.FirstFooter,
            ContentPartType.EvenPagesFooter
        ];
        const parts = await Promise.all(partTypes.map(p => this.getContentPart(p)));
        return parts.filter(p => !!p);
    }

    public async export<T extends Binary>(outputType: Constructor<T>): Promise<T> {
        await this.saveChanges();
        return await this.zip.export(outputType);
    }

    //
    // private methods
    //

    private async getHeaderOrFooter(type: ContentPartType): Promise<XmlPart> {
        const nodeName = this.headerFooterNodeName(type);
        const nodeTypeAttribute = this.headerFooterType(type);

        const docRoot = await this.mainDocument.xmlRoot();
        const body = docRoot.childNodes.find(node => node.nodeName == 'w:body');
        if (body == null)
            return null;

        const sectionProps: XmlGeneralNode[] = [];

        // Get section props from paragraphs
        body.childNodes.forEach(node => {
            if (node.nodeType === XmlNodeType.General && node.nodeName === 'w:p') {
                const pPr = node.childNodes.find(child =>
                    child.nodeType === XmlNodeType.General &&
                    child.nodeName === 'w:pPr'
                );
                const sectPr = pPr?.childNodes.find(child =>
                    child.nodeType === XmlNodeType.General &&
                    child.nodeName === 'w:sectPr'
                );
                if (sectPr) {
                    sectionProps.push(sectPr as XmlGeneralNode);
                }
            }
        });

        // Get document level section props
        const docSectPr = last(body.childNodes.filter(node =>
            node.nodeType === XmlNodeType.General &&
            node.nodeName === 'w:sectPr'
        ));
        if (docSectPr) {
            sectionProps.push(docSectPr as XmlGeneralNode);
        }

        // Find header/footer reference in section props
        const reference = sectionProps.reduce<XmlNode>((found, sectPr) => {
            if (found) return found;
            return sectPr.childNodes?.find(node =>
                node.nodeType === XmlNodeType.General &&
                node.nodeName === nodeName &&
                node.attributes?.['w:type'] === nodeTypeAttribute
            );
        }, null);

        const relId = (reference as XmlGeneralNode)?.attributes?.['r:id'];
        if (!relId) return null;

        // Get or create XmlPart for the header/footer
        const rels = await this.mainDocument.rels.list();
        const relTarget = rels.find(r => r.id === relId).target;
        if (!this._parts[relTarget]) {
            this._parts[relTarget] = new XmlPart(
                "word/" + relTarget,
                this.zip,
                this.xmlParser
            );
        }
        return this._parts[relTarget];
    }

    private headerFooterNodeName(contentPartType: ContentPartType): string {
        switch (contentPartType) {

            case ContentPartType.DefaultHeader:
            case ContentPartType.FirstHeader:
            case ContentPartType.EvenPagesHeader:
                return 'w:headerReference';

            case ContentPartType.DefaultFooter:
            case ContentPartType.FirstFooter:
            case ContentPartType.EvenPagesFooter:
                return 'w:footerReference';

            default:
                throw new Error(`Invalid content part type: '${contentPartType}'.`);
        }
    }

    private headerFooterType(contentPartType: ContentPartType): string {

        // https://docs.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.headerfootervalues?view=openxml-2.8.1

        switch (contentPartType) {

            case ContentPartType.DefaultHeader:
            case ContentPartType.DefaultFooter:
                return 'default';

            case ContentPartType.FirstHeader:
            case ContentPartType.FirstFooter:
                return 'first';

            case ContentPartType.EvenPagesHeader:
            case ContentPartType.EvenPagesFooter:
                return 'even';

            default:
                throw new Error(`Invalid content part type: '${contentPartType}'.`);
        }
    }

    private async saveChanges() {

        const parts = [
            this.mainDocument,
            ...Object.values(this._parts)
        ];
        for (const part of parts) {
            await part.saveChanges();
        }

        await this.contentTypes.save();
    }
}
