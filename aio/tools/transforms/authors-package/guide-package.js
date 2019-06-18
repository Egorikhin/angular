/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/* eslint no-console: "off" */

let Package = require('dgeni').Package;
let contentPackage = require('../angular-content-package');
let { readFileSync } = require('fs');
let { resolve } = require('canonical-path');
let { CONTENTS_PATH } = require('../config');

function createPackage(guideName) {

  let guideFilePath = `${CONTENTS_PATH}/guide/${guideName}.md`;
  let guideFile = readFileSync(guideFilePath, 'utf8');
  let examples = [];
  guideFile.replace(/<code-(?:pane|example) [^>]*path="([^"]+)"/g, (_, path) => examples.push('examples/' + path));

  if (examples.length) {
    console.log('The following example files are referenced in this guide:');
    console.log(examples.map(example => ' - ' + example).join('\n'));
  }

  return new Package('author-guide', [contentPackage])
    .config(function(readFilesProcessor) {
      readFilesProcessor.sourceFiles = [
        {
          basePath: CONTENTS_PATH,
          include: guideFilePath,
          fileReader: 'contentFileReader'
        },
        {
          basePath: CONTENTS_PATH,
          include: examples.map(example => resolve(CONTENTS_PATH, example)),
          fileReader: 'exampleFileReader'
        }
      ];
    });
}

module.exports = { createPackage };