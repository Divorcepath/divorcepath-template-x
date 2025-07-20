const easy = require('npm:easy-template-x@^4.1.6');
const fs = require('node:fs');

async function main() {
    const templateFile = fs.readFileSync('../template.docx');
    const data = {
        "Beers": [
            { "Brand": "Carlsberg", "Price": 1 },
            { "Brand": "Leaf Blonde", "Price": 2 },
            { "Brand": "Weihenstephan", "Price": 1.5 }
        ]
    };

    const handler = new easy.TemplateHandler();
    await handler.process(templateFile, data);

    console.log('cjs verification completed successfully');
}
main();
