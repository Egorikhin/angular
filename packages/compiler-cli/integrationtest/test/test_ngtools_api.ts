#!/usr/bin/env node
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

// Must be imported first, because Angular decorators throw on load.
import 'reflect-metadata';

import * as path from 'path';
import * as ts from 'typescript';
import * as assert from 'assert';
import {createProgram, readConfiguration} from '@angular/compiler-cli';

/* tslint:disable:no-console  */
/**
 * Main method.
 * Standalone program that executes codegen using the ngtools API and tests that files were
 * properly read and wrote.
 */
function main() {
  Promise.resolve().then(() => lazyRoutesTest()).then(() => { process.exit(0); }).catch((err) => {
    console.error(err.stack);
    process.exit(1);
  });
}

function lazyRoutesTest() {
  let basePath = path.join(__dirname, '../ngtools_src');
  let project = path.join(basePath, 'tsconfig-build.json');

  let config = readConfiguration(project);
  let host = ts.createCompilerHost(config.options, true);
  let program = createProgram({
    rootNames: config.rootNames,
    options: config.options, host,
  });

  config.options.basePath = basePath;
  config.options.rootDir = basePath;

  let lazyRoutes = program.listLazyRoutes('app.module#AppModule');
  let expectations: {[route: string]: string} = {
    './lazy.module#LazyModule': 'lazy.module.ts',
    './feature/feature.module#FeatureModule': 'feature/feature.module.ts',
    './feature/lazy-feature.module#LazyFeatureModule': 'feature/lazy-feature.module.ts',
    './feature.module#FeatureModule': 'feature/feature.module.ts',
    './lazy-feature-nested.module#LazyFeatureNestedModule': 'feature/lazy-feature-nested.module.ts',
    'feature2/feature2.module#Feature2Module': 'feature2/feature2.module.ts',
    './default.module': 'feature2/default.module.ts',
    'feature/feature.module#FeatureModule': 'feature/feature.module.ts'
  };

  lazyRoutes.forEach(lazyRoute => {
    let routeName = lazyRoute.route;

    // Normalize the module path and the expected module path so that these can be compared
    // on Windows where path separators are not consistent with TypeScript internal paths.
    let modulePath = path.normalize(lazyRoute.referencedModule.filePath);
    let expectedModulePath = path.normalize(path.join(basePath, expectations[routeName]));

    assert(routeName in expectations, `Found a route that was not expected: "${routeName}".`);
    assert(
        modulePath === expectedModulePath,
        `Route "${routeName}" does not point to the expected absolute path ` +
            `"${expectedModulePath}". It points to "${modulePath}"`);
  });

  // Verify that all expectations were met.
  assert.deepEqual(
      lazyRoutes.map(lazyRoute => lazyRoute.route), Object.keys(expectations),
      `Expected routes listed to be: \n` +
          `  ${JSON.stringify(Object.keys(expectations))}\n` +
          `Actual:\n` +
          `  ${JSON.stringify(Object.keys(lazyRoutes))}\n`);
}

main();
