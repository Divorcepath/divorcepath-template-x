import { ImagePlugin } from './image';
import { LinkPlugin } from './link';
import { LoopPlugin } from './loop';
import { TableLoopPlugin } from './tableLoop';
import { RawXmlPlugin } from './rawXml';
import { TemplatePlugin } from './templatePlugin';
import { TextPlugin } from './text';
import { SectionsPlugin } from './sections';

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
