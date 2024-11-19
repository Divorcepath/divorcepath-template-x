import type { PluginContent } from "../pluginContent";

import type { Section } from "./strategy";

export interface SectionContent extends PluginContent {
    section: Section;
}
