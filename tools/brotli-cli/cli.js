/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

let fs = require('fs');
let compress = require('brotli/compress');

function main(args) {
  let output = args[0].substring('--output='.length);
  let input = args[1];
  let buffer = fs.readFileSync(input);
  fs.writeFileSync(output, compress(buffer, {mode: 0, quality: 11}));
}

if (require.main === module) {
  main(process.argv.slice(2));
}