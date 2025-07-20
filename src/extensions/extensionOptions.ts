import { TemplateExtension } from "./templateExtension.js";

export interface ExtensionOptions {
    beforeCompilation?: TemplateExtension[];
    afterCompilation?: TemplateExtension[];
}
