import { IMap } from '../types.js';
import { XmlTextNode } from '../xml/index.js';

export enum TagDisposition {
    Open = "Open",
    Close = "Close",
    SelfClosed = "SelfClosed"
}

export interface Tag {
    name: string;
    options?: IMap<any>;
    /**
     * The full tag text, for instance: "{#my-tag}".
     */
    rawText: string;
    disposition: TagDisposition;
    xmlTextNode: XmlTextNode;
}
