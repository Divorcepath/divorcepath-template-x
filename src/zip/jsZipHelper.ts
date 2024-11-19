import { MissingArgumentError } from '../errors';
import { Constructor } from '../types';
import { Binary } from '../utils';

export class JsZipHelper {

    public static toJsZipOutputType(binary: Binary): any;
    public static toJsZipOutputType(binaryType: Constructor<Binary>): any;
    public static toJsZipOutputType(binaryOrType: Binary | Constructor<Binary>): any {

        if (!binaryOrType)
            throw new MissingArgumentError(nameof(binaryOrType));

        let binaryType: Constructor<Binary>;
        if (typeof binaryOrType === 'function') {
            binaryType = binaryOrType as Constructor<Binary>;
        } else {
            binaryType = binaryOrType.constructor as Constructor<Binary>;
        }

        if (Binary.isBlobConstructor(binaryType))
            return 'blob';
        if (Binary.isArrayBufferConstructor(binaryType))
            return 'arraybuffer';
        if (Binary.isBufferConstructor(binaryType))
            return 'nodebuffer';

        throw new Error(`Binary type '${(binaryType as any).name}' is not supported.`);
    }
}
