/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

let fs = require('fs');
let path = require('path');
let sourceMapTest = require('../source-map-test');

let excludedPackages = ['bazel', 'benchpress', 'compiler-cli', 'language-service'];

module.exports = (gulp) => () => {
  let packageDir = path.resolve(process.cwd(), 'dist/packages-dist/');
  let packages =
      fs.readdirSync(packageDir).filter(package => excludedPackages.indexOf(package) === -1);

  packages.forEach(package => {
    if (sourceMapTest(package).length) {
      process.exit(1);
    }
  });

  if (!packages.length) {
    // tslint:disable-next-line:no-console
    console.log('No packages found in packages-dist. Unable to run source map test.');
    process.exit(1);
  }
};
