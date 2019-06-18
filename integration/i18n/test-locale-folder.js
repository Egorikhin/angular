let fs = require('fs');
let path = require('path');

let packageJson = require('@angular/common/package.json');
let localesFolder = packageJson['locales'];
if (!localesFolder) {
  throw new Error(`@angular/common/package.json does not contain 'locales' entry.`)
}
let enLocalePath = `@angular/common/${localesFolder}/en`;
try {
  require.resolve(enLocalePath);
} catch (err) {
  throw new Error(`@angular/common does not contain 'en' locale in ${enLocalePath}.`)
}
