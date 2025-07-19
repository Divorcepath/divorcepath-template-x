export interface PluginContent {
    _type: string;
}
export declare const PluginContent: {
    isPluginContent(content: unknown): content is PluginContent;
};
