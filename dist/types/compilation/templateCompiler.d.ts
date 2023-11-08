import { TemplatePlugin } from "../plugins";
import { Delimiters } from "../delimiters";
import { XmlNode } from "../xml";
import { DelimiterSearcher } from "./delimiterSearcher";
import { ScopeData } from "./scopeData";
import { Tag } from "./tag";
import { TagParser } from "./tagParser";
import { TemplateContext } from "./templateContext";
export interface TemplateCompilerOptions {
    defaultContentType: string;
    containerContentType: string;
    tableContainerContentType: string;
    sectionsContentType: string;
    skipEmptyTags?: boolean;
}
export declare class TemplateCompiler {
    private readonly delimiters;
    private readonly delimiterSearcher;
    private readonly tagParser;
    private readonly options;
    private readonly pluginsLookup;
    constructor(delimiters: Partial<Delimiters>, delimiterSearcher: DelimiterSearcher, tagParser: TagParser, plugins: TemplatePlugin[], options: TemplateCompilerOptions);
    compile(node: XmlNode, data: ScopeData, context: TemplateContext): Promise<void>;
    parseTags(node: XmlNode): Tag[];
    private doTagReplacements;
    private detectContentType;
    private simpleTagReplacements;
    private findCloseTagIndex;
}
