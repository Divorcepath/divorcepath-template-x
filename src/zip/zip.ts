import { Constructor } from '../types';
import { Binary } from '../utils';
import { ZipObject } from './zipObject';
import PizZipClass from 'pizzip';
import * as PizZip from 'pizzip';

export class Zip {

    public static async load(file: Binary): Promise<Zip> {
        try {
            const pizzip = new PizZipClass(file as any);
            // const zip = pizzip.load(file as any, { optimizedBinaryString: true });
            return new Zip(pizzip);
        } catch (error) {
            console.log(error)
            throw error;
        }

    }

    private constructor(private readonly zip: PizZip) {
    }

    public getFile(path: string): ZipObject {
        const internalZipObject = this.zip.files[path];
        if (!internalZipObject)
            return null;
        return new ZipObject(internalZipObject);
    }

    public setFile(path: string, content: string | Binary): void {
        this.zip.file(path, content as any);
    }

    public isFileExist(path: string): boolean {
        return !!this.zip.files[path];
    }

    public listFiles(): string[] {
        return Object.keys(this.zip.files);
    }

    public async export<T extends Binary>(outputType: Constructor<T>): Promise<T> {
        // const zipOutputType: JSZip.OutputType = JsZipHelper.toJsZipOutputType(outputType);
        // const output = await this.zip.generateAsync({
        //     type: zipOutputType,
        //     compression: "DEFLATE",
        //     compressionOptions: {
        //         level: 6 // between 1 (best speed) and 9 (best compression)
        //     }
        // });
        // return output as T;
        return this.zip.generate({ type: 'nodebuffer' }) as unknown as T;
    }
}
