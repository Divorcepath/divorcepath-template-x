import autoExternal from 'npm:rollup-plugin-auto-external@2.0.0';
import babel from 'npm:rollup-plugin-babel@4.4.0';
import nodeResolve from 'npm:rollup-plugin-node-resolve@5.2.0';
import replace from 'npm:@rollup/plugin-replace@5.0.7';

import pkg from './package.json' with { type: "json" };

const extensions = ['.ts'];

export default {
    input: 'src/index.ts',
    output: [
        {
            file: 'dist/cjs/easy-template-x.cjs',
            format: 'cjs'
        },
        {
            file: 'dist/es/easy-template-x.mjs',
            format: 'es'
        }
    ],
    plugins: [
        autoExternal(),
        nodeResolve({
            extensions
        }),
        replace({
            // replace options
            preventAssignment: true,

            // keywords:
            EASY_VERSION: JSON.stringify(pkg.version)
        }),
        babel({
            extensions,
        })
    ]
};
