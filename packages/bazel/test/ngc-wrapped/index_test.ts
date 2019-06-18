/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as path from 'path';

import {setup} from './test_support';

describe('ngc_wrapped', () => {

  it('should work', () => {
    let {read, write, runOneBuild, writeConfig, shouldExist, basePath} = setup();

    write('some_project/index.ts', `
      import {Component} from '@angular/core';
      import {a} from 'ambient_module';
      console.log('works: ', Component);
    `);

    let tsconfig = writeConfig({
      srcTargetPath: 'some_project',
    });
    let typesFile = path.resolve(
        tsconfig.compilerOptions.rootDir, tsconfig.compilerOptions.typeRoots[0], 'thing',
        'index.d.ts');

    write(typesFile, `
      declare module "ambient_module" {
        declare let a = 1;
      }
    `);

    // expect no error
    expect(runOneBuild()).toBe(true);

    shouldExist('bazel-bin/some_project/index.js');

    expect(read('bazel-bin/some_project/index.js'))
        .toContain(`console.log('works: ', core_1.Component);`);
  });
});
