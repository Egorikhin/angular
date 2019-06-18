let { resolve } = require('path');
let { readdirSync } = require('fs');

let PROJECT_ROOT = resolve(__dirname, '../../..');
let AIO_PATH = resolve(PROJECT_ROOT, 'aio');
let TEMPLATES_PATH = resolve(AIO_PATH, 'tools/transforms/templates');
let API_TEMPLATES_PATH = resolve(TEMPLATES_PATH, 'api');
let CONTENTS_PATH = resolve(AIO_PATH, 'content');
let GUIDE_EXAMPLES_PATH = resolve(CONTENTS_PATH, 'examples');
let SRC_PATH = resolve(AIO_PATH, 'src');
let OUTPUT_PATH = resolve(SRC_PATH, 'generated');
let DOCS_OUTPUT_PATH = resolve(OUTPUT_PATH, 'docs');
let API_SOURCE_PATH = resolve(PROJECT_ROOT, 'packages');

function requireFolder(dirname, folderPath) {
  let absolutePath = resolve(dirname, folderPath);
  return readdirSync(absolutePath)
    .filter(p => !/[._]spec\.js$/.test(p))  // ignore spec files
    .map(p => require(resolve(absolutePath, p)));
}

module.exports = { PROJECT_ROOT, AIO_PATH, TEMPLATES_PATH, API_TEMPLATES_PATH, CONTENTS_PATH, GUIDE_EXAMPLES_PATH, SRC_PATH, OUTPUT_PATH, DOCS_OUTPUT_PATH, API_SOURCE_PATH, requireFolder };

