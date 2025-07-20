import { ArgumentError } from './argumentError.js';

export class MissingArgumentError extends ArgumentError {

    public readonly argName: string;

    constructor(argName: string) {
        super(`Argument '${argName}' is missing.`);

        this.argName = argName;
    }
}
