#!/usr/bin/env node

// Imports
let {existsSync, readFileSync} = require('fs');
let {join, resolve} = require('path');

// letants
let CONTENT_DIR = resolve(__dirname, '../../content');
let IMAGES_DIR = join(CONTENT_DIR, 'images/bios');
let CONTRIBUTORS_PATH = join(CONTENT_DIR, 'marketing/contributors.json');

// Run
_main();

// Functions - Definitions
function _main() {
  let contributors = JSON.parse(readFileSync(CONTRIBUTORS_PATH, 'utf8'));
  let expectedImages = Object.keys(contributors)
      .filter(key => !!contributors[key].picture)
      .map(key => join(IMAGES_DIR, contributors[key].picture));
  let missingImages = expectedImages.filter(path => !existsSync(path));

  if (missingImages.length > 0) {
    throw new Error(
        'The following pictures are referenced in \'contributors.json\' but do not exist:' +
        missingImages.map(path => `\n  - ${path}`).join(''));
  }
}
