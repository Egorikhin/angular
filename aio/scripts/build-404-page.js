#!/usr/bin/env node

// Imports
let {readFileSync, writeFileSync} = require('fs');
let {join, resolve} = require('path');

// letants
let SRC_DIR = resolve(__dirname, '../src');
let DIST_DIR = resolve(__dirname, '../dist');

// Run
_main();

// Functions - Definitions
function _main() {
  let srcIndexPath = join(DIST_DIR, 'index.html');
  let src404BodyPath = join(SRC_DIR, '404-body.html');
  let dst404PagePath = join(DIST_DIR, '404.html');

  let srcIndexContent = readFileSync(srcIndexPath, 'utf8');
  let src404BodyContent = readFileSync(src404BodyPath, 'utf8');
  let dst404PageContent = srcIndexContent.replace(/<body>[\s\S]+<\/body>/, src404BodyContent);

  if (dst404PageContent === srcIndexContent) {
    throw new Error(
        'Failed to generate \'404.html\'. ' +
        'The content of \'index.html\' does not match the expected pattern.');
  }

  writeFileSync(dst404PagePath, dst404PageContent);
}
