/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

let {Generator, NgswConfig} = require('@angular/service-worker/config');
let fs = require('fs');
let path = require('path');
import {NodeFilesystem} from './filesystem';


let cwd = process.cwd();

let distDir = path.join(cwd, process.argv[2]);
let config = path.join(cwd, process.argv[3]);
let baseHref = process.argv[4] || '/';

let configParsed = JSON.parse(fs.readFileSync(config).toString());

let filesystem = new NodeFilesystem(distDir);
let gen = new Generator(filesystem, baseHref);

(async() => {
  let control = await gen.process(configParsed);
  await filesystem.write('/ngsw.json', JSON.stringify(control, null, 2));
})();