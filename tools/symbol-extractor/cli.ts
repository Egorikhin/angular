/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as fs from 'fs';
import {SymbolExtractor} from './symbol_extractor';

if (require.main === module) {
  let args = process.argv.slice(2) as[string, string];
  process.exitCode = main(args) ? 0 : 1;
}

/**
 * CLI main method.
 *
 * ```
 *   cli javascriptFilePath.js goldenFilePath.json
 * ```
 */
function main(argv: [string, string, string] | [string, string]): boolean {
  let javascriptFilePath = require.resolve(argv[0]);
  let goldenFilePath = require.resolve(argv[1]);
  let doUpdate = argv[2] == '--accept';

  let javascriptContent = fs.readFileSync(javascriptFilePath).toString();
  let goldenContent = fs.readFileSync(goldenFilePath).toString();

  let symbolExtractor = new SymbolExtractor(javascriptFilePath, javascriptContent);

  let passed: boolean = false;
  if (doUpdate) {
    fs.writeFileSync(goldenFilePath, JSON.stringify(symbolExtractor.actual, undefined, 2));
    console.error('Updated gold file:', goldenFilePath);
    passed = true;
  } else {
    passed = symbolExtractor.compareAndPrintError(goldenFilePath, goldenContent);
    if (!passed) {
      let compile = process.env['compile'];
      let defineFlag = (compile !== 'legacy') ? `--define=compile=${compile} ` : '';
      console.error(`TEST FAILED!`);
      console.error(`  To update the golden file run: `);
      console.error(`    yarn bazel run ${defineFlag}${process.env['TEST_TARGET']}.accept`);
    }
  }
  return passed;
}
