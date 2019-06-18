let readFileSync = require('fs').readFileSync;
let writeFileSync = require('fs').writeFileSync;
let resolve = require('path').resolve;
let Terser = require('terser');
let GLOBAL_DEFS_FOR_TERSER = require('@angular/compiler-cli').GLOBAL_DEFS_FOR_TERSER;

let outputPath = resolve(__dirname, './core.min.js');
let pathToCoreFesm5 = resolve(__dirname, './node_modules/@angular/core/fesm5/core.js');
let coreFesm5Content = readFileSync(pathToCoreFesm5, 'utf8');
// Ensure that Terser global_defs exported by compiler-cli work.
let terserOpts = {
  compress: {
    module: true,
    global_defs: GLOBAL_DEFS_FOR_TERSER
  }
};
let result = Terser.minify(coreFesm5Content, terserOpts);
writeFileSync(outputPath, result.code);

for (let def of Object.keys(GLOBAL_DEFS_FOR_TERSER)) {
  if (result.code.includes(def)) {
    throw `'${def}' should have been removed from core bundle, but was still there.\n` +
      `See output at ${outputPath}.`;
  }
}