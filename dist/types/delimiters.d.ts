export declare class Delimiters {
    tagStart: string;
    tagEnd: string;
    containerTagOpen: string;
    tableTagOpen: string;
    sectionTagOpen: string;
    containerTagClose: string;
    constructor(initial?: Partial<Delimiters>);
    private encodeAndValidate;
}
