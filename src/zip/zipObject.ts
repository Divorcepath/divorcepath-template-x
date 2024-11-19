import * as PizZip from 'pizzip';
import { Constructor } from '../types';
import { Binary } from '../utils';
// import { JsZipHelper } from './jsZipHelper';

export class ZipObject {

    public get name(): string {
        return this.zipObject.name;
    }

    public set name(value: string) {
        this.zipObject.name = value;
    }

    public get isDirectory(): boolean {
        return this.zipObject.dir;
    }

    constructor(private readonly zipObject: PizZip.ZipObject) { }

    public async getContentText(): Promise<string> {
        return this.zipObject.asText();
    }

    public async getContentBase64(): Promise<string> {
        return this.zipObject.asBinary();
    }

    public async getContentBinary<T extends Binary>(outputType: Constructor<T>): Promise<T> {
        // const zipOutputType = JsZipHelper.toJsZipOutputType(outputType);
        return this.zipObject.asBinary() as unknown as T;
    }
}
