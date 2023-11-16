import { PluginContent } from "../pluginContent";
import { Section } from "./strategy";
export interface SectionContent extends PluginContent {
    section: Section;
}
