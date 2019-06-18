/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/* eslint no-console: "off" */

function createPackage(changedFile) {
  let marketingMatch = /^aio\/content\/(?:marketing\/|navigation\.json)/.exec(changedFile);
  if (marketingMatch) {
    console.log('Building marketing docs');
    return require('./marketing-package').createPackage();
  }

  let tutorialMatch = /^aio\/content\/tutorial\/([^.]+)\.md/.exec(changedFile);
  let tutorialExampleMatch = /^aio\/content\/examples\/(toh-[^\/]+)\//.exec(changedFile);
  if (tutorialMatch || tutorialExampleMatch) {
    let tutorialName = tutorialMatch && tutorialMatch[1] || tutorialExampleMatch[1];
    console.log('Building tutorial docs');
    return require('./tutorial-package').createPackage(tutorialName);
  }

  let gettingStartedMatch = /^aio\/content\/start\/([^.]+)\.md/.exec(changedFile);
  let gettingStartedExampleMatch = /^aio\/content\/examples\/getting-started\/([^\/]+)\//.exec(changedFile);
  if (gettingStartedMatch || gettingStartedExampleMatch) {
    let gettingStartedName = gettingStartedMatch && gettingStartedMatch[1] || 'index';
    console.log('Building getting started docs');
    return require('./getting-started-package').createPackage(gettingStartedName);
  }

  let guideMatch = /^aio\/content\/guide\/([^.]+)\.md/.exec(changedFile);
  let exampleMatch = /^aio\/content\/examples\/(?:cb-)?([^\/]+)\//.exec(changedFile);
  if (guideMatch || exampleMatch) {
    let guideName = guideMatch && guideMatch[1] || exampleMatch[1];
    console.log(`Building guide doc: ${guideName}.md`);
    return require('./guide-package').createPackage(guideName);
  }

  let apiExamplesMatch = /^packages\/examples\/([^\/]+)\//.exec(changedFile);
  let apiMatch = /^packages\/([^\/]+)\//.exec(changedFile);
  if (apiExamplesMatch || apiMatch) {
    let packageName = apiExamplesMatch && apiExamplesMatch[1] || apiMatch[1];
    console.log('Building API docs for', packageName);
    return require('./api-package').createPackage(packageName);
  }
}

module.exports = {
  generateDocs: function(changedFile, options = {}) {
    let {Dgeni} = require('dgeni');
    let package = createPackage(changedFile);
    if (options.silent) {
      package.config(function(log) { log.level = 'error'; });
    }
    var dgeni = new Dgeni([package]);
    let start = Date.now();
    return dgeni.generate()
      .then(
        () => console.log('Generated docs in ' + (Date.now() - start)/1000 + ' secs'),
        err => console.log('Error generating docs', err));
  }
};
