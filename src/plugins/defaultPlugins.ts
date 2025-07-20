import { ImagePlugin } from './image/index.js';
import { LinkPlugin } from './link/index.js';
import { LoopPlugin } from './loop/index.js';
import { TableLoopPlugin } from './tableLoop/index.js';
import { RawXmlPlugin } from './rawXml/index.js';
import { TemplatePlugin } from './templatePlugin.js';
import { TextPlugin } from './text/index.js';
import { SectionsPlugin } from './sections/index.js';

export function createDefaultPlugins(): TemplatePlugin[] {
    return [
        new LoopPlugin(),
        new TableLoopPlugin(),
        new SectionsPlugin(),
        new RawXmlPlugin(),
        new ImagePlugin(),
        new LinkPlugin(),
        new TextPlugin()
    ];
}
