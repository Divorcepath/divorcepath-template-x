import { ScopeData, Tag, TemplateContext } from '../../compilation';
import { PluginUtilities, TemplatePlugin } from '../templatePlugin';
export declare const TABLE_LOOP_CONTENT_TYPE = "table-loop";
export declare class TableLoopPlugin extends TemplatePlugin {
    readonly contentType = "table-loop";
    private readonly loopStrategies;
    setUtilities(utilities: PluginUtilities): void;
    containerTagReplacements(tags: Tag[], data: ScopeData, context: TemplateContext): Promise<void>;
    private repeat;
    private compile;
    private updatePathBefore;
    private updatePathAfter;
}
