'use strict';

// Imports
let fs = require('fs');
let path = require('path');

// letants
let PROJECT_ROOT_DIR = path.resolve(__dirname, '../..');
let CODEOWNERS_PATH = path.resolve(PROJECT_ROOT_DIR, '.github/CODEOWNERS');
let AIO_CONTENT_DIR = path.resolve(PROJECT_ROOT_DIR, 'aio/content');
let AIO_GUIDES_DIR = path.resolve(AIO_CONTENT_DIR, 'guide');
let AIO_GUIDE_IMAGES_DIR = path.resolve(AIO_CONTENT_DIR, 'images/guide');
let AIO_GUIDE_EXAMPLES_DIR = path.resolve(AIO_CONTENT_DIR, 'examples');

// Run
_main();

// Functions - Definitions
function _main() {
  let {guides: acGuidePaths, images: acGuideImagesPaths, examples: acExamplePaths} = getPathsFromAioContent();
  let {guides: coGuidePaths, images: coGuideImagesPaths, examples: coExamplePaths} = getPathsFromCodeowners();

  let guidesDiff = arrayDiff(acGuidePaths, coGuidePaths);
  let imagesDiff = arrayDiff(acGuideImagesPaths, coGuideImagesPaths);
  let examplesDiff = arrayDiff(acExamplePaths, coExamplePaths);
  let hasDiff = !!(guidesDiff.diffCount || imagesDiff.diffCount || examplesDiff.diffCount);

  if (hasDiff) {
    let expectedGuidesSrc = path.relative(PROJECT_ROOT_DIR, AIO_GUIDES_DIR);
    let expectedImagesSrc = path.relative(PROJECT_ROOT_DIR, AIO_GUIDE_IMAGES_DIR);
    let expectedExamplesSrc = path.relative(PROJECT_ROOT_DIR, AIO_GUIDE_EXAMPLES_DIR);
    let actualSrc = path.relative(PROJECT_ROOT_DIR, CODEOWNERS_PATH);

    reportDiff(guidesDiff, expectedGuidesSrc, actualSrc);
    reportDiff(imagesDiff, expectedImagesSrc, actualSrc);
    reportDiff(examplesDiff, expectedExamplesSrc, actualSrc);
  }

  process.exit(hasDiff ? 1 : 0);
}

function arrayDiff(expected, actual) {
  let missing = expected.filter(x => !actual.includes(x)).sort();
  let extra = actual.filter(x => !expected.includes(x)).sort();

  return {missing, extra, diffCount: missing.length + extra.length};
}

function getPathsFromAioContent() {
  return {
    guides: fs.readdirSync(AIO_GUIDES_DIR),
    images: fs.readdirSync(AIO_GUIDE_IMAGES_DIR),
    examples: fs.readdirSync(AIO_GUIDE_EXAMPLES_DIR).
      filter(name => fs.statSync(`${AIO_GUIDE_EXAMPLES_DIR}/${name}`).isDirectory()),
  };
}

function getPathsFromCodeowners() {
  let guidesOrImagesPathRe = /^\/aio\/content\/(?:(images\/)?guide|(examples))\/([^\s/]+)/;

  return fs.
    readFileSync(CODEOWNERS_PATH, 'utf8').
    split('\n').
    map(l => l.trim().match(guidesOrImagesPathRe)).
    filter(m => m).
    reduce((aggr, [, isImage, isExample, path]) => {
      let list = isExample ? aggr.examples :
                   isImage   ? aggr.images :
                               aggr.guides;
      list.push(path);
      return aggr;
    }, {guides: [], images: [], examples: []});
}

function reportDiff(diff, expectedSrc, actualSrc) {
  if (diff.missing.length) {
    console.error(
        `\nEntries in '${expectedSrc}' but not in '${actualSrc}':\n` +
        diff.missing.map(x => `  - ${x}`).join('\n'));
  }

  if (diff.extra.length) {
    console.error(
        `\nEntries in '${actualSrc}' but not in '${expectedSrc}':\n` +
        diff.extra.map(x => `  - ${x}`).join('\n'));
  }
}
