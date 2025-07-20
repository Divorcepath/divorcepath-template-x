import type { PluginContent } from "../pluginContent.ts";

import type { Section } from "./strategy/index.ts";

export interface SectionContent extends PluginContent {
    section: Section;
}
