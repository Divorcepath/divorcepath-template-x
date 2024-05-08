import type { ScopeData, Tag, TemplateContext } from "../../compilation";
import { type PluginUtilities, TemplatePlugin } from "../templatePlugin";
export declare const SECTIONS_CONTENT_TYPE = "sections";
export declare class SectionsPlugin extends TemplatePlugin {
    readonly contentType = "sections";
    private readonly loopStrategies;
    setUtilities(utilities: PluginUtilities): void;
    containerTagReplacements(tags: Tag[], data: ScopeData, context: TemplateContext): Promise<void>;
    private repeat;
    private compile;
    private updatePathBefore;
    private updatePathAfter;
}
