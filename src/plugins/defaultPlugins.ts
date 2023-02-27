import { ImagePlugin } from './image';
import { LinkPlugin } from './link';
import { LoopPlugin } from './loop';
import { TableLoopPlugin } from './tableLoop';
import { RawXmlPlugin } from './rawXml';
import { TemplatePlugin } from './templatePlugin';
import { TextPlugin } from './text';

export function createDefaultPlugins(): TemplatePlugin[] {
    return [
        new LoopPlugin(),
        new TableLoopPlugin(),
        new RawXmlPlugin(),
        new ImagePlugin(),
        new LinkPlugin(),
        new TextPlugin()
    ];
}
