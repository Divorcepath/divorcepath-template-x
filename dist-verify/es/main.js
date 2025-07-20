import { TemplateHandler } from 'npm:easy-template-x@^4.1.6';
import * as fs from 'node:fs';

async function main() {
    const templateFile = fs.readFileSync('../template.docx');
    const data = {
        "Beers": [
            { "Brand": "Carlsberg", "Price": 1 },
            { "Brand": "Leaf Blonde", "Price": 2 },
            { "Brand": "Weihenstephan", "Price": 1.5 }
        ]
    };

    const handler = new TemplateHandler();
    await handler.process(templateFile, data);

    console.log('es verification completed successfully');
}
main();
