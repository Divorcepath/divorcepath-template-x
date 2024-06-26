import * as PizZip from 'pizzip';
import { Constructor } from '../types';
import { Binary } from '../utils';
export declare class ZipObject {
    private readonly zipObject;
    get name(): string;
    set name(value: string);
    get isDirectory(): boolean;
    constructor(zipObject: PizZip.ZipObject);
    getContentText(): Promise<string>;
    getContentBase64(): Promise<string>;
    getContentBinary<T extends Binary>(outputType: Constructor<T>): Promise<T>;
}
