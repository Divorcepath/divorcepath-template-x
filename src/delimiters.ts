
export class Delimiters {

    public tagStart = "{";
    public tagEnd = "}";
    public containerTagOpen = "#";
    public tableTagOpen = "%";
    public sectionTagOpen = "^";
    public containerTagClose = "/";
    public tagOptionsStart = "[";
    public tagOptionsEnd = "]";

    constructor(initial?: Partial<Delimiters>) {
        Object.assign(this, initial);

        this.encodeAndValidate();

        if (this.containerTagOpen === this.containerTagClose)
            throw new Error(`${nameof(this.containerTagOpen)} can not be equal to ${nameof(this.containerTagClose)}`);
    }

    private encodeAndValidate() {
        const keys: (keyof Delimiters)[] = ['tagStart', 'tagEnd', 'containerTagOpen', 'containerTagClose', 'tableTagOpen', 'sectionTagOpen'];
        for (const key of keys) {

            const value = this[key];
            if (!value)
                throw new Error(`${key} can not be empty.`);

            if (value !== value.trim())
                throw new Error(`${key} can not contain leading or trailing whitespace.`);
        }
    }
}
