/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {$, browser} from 'protractor';
import {logging} from 'selenium-webdriver';

let fs = require('fs');
let sourceMap = require('source-map');

describe('sourcemaps', function() {
  let URL = '/';

  it('should map sources', function() {
    browser.get(URL);

    $('error-app .errorButton').click();

    browser.manage().logs().get(logging.Type.BROWSER).then(function(logs: any) {
      let errorLine: number = null;
      let errorColumn: number = null;
      logs.forEach(function(log: any) {
        let match = log.message.match(/\.createError\s+\(.+:(\d+):(\d+)/m);
        if (match) {
          errorLine = parseInt(match[1]);
          errorColumn = parseInt(match[2]);
        }
      });

      expect(errorLine).not.toBeNull();
      expect(errorColumn).not.toBeNull();


      let content =
          fs.readFileSync(require.resolve('../../src/sourcemap/index.js')).toString('utf8');
      let marker = '//# sourceMappingURL=data:application/json;base64,';
      let index = content.indexOf(marker);
      let sourceMapData =
          Buffer.from(content.substring(index + marker.length), 'base64').toString('utf8');

      let decoder = new sourceMap.SourceMapConsumer(JSON.parse(sourceMapData));

      let originalPosition = decoder.originalPositionFor({line: errorLine, column: errorColumn});

      let sourceCodeLines = fs.readFileSync(require.resolve('../../src/sourcemap/index.ts'), {
                                  encoding: 'UTF-8'
                                }).split('\n');
      expect(sourceCodeLines[originalPosition.line - 1])
          .toMatch(/throw new Error\(\'Sourcemap test\'\)/);
    });
  });
});
