/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

let Package = require('dgeni').Package;
let contentPackage = require('../angular-content-package');
let { readFileSync } = require('fs');
let { resolve } = require('canonical-path');
let { CONTENTS_PATH } = require('../config');

/* eslint no-console: "off" */

function createPackage(tutorialName) {

  let tutorialFilePath = `${CONTENTS_PATH}/start/${tutorialName}.md`;
  let tutorialFile = readFileSync(tutorialFilePath, 'utf8');
  let examples = [];
  tutorialFile.replace(/<code-(?:pane|example) [^>]*path="([^"]+)"/g, (_, path) => examples.push('examples/' + path));

  if (examples.length) {
    console.log('The following example files are referenced in this getting-started:');
    console.log(examples.map(example => ' - ' + example).join('\n'));
  }

  return new Package('author-getting-started', [contentPackage])
    .config(function(readFilesProcessor) {
      readFilesProcessor.sourceFiles = [
        {
          basePath: CONTENTS_PATH,
          include: tutorialFilePath,
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