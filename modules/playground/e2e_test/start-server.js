/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

let protractorUtils = require('@angular/bazel/protractor-utils');
let protractor = require('protractor');

module.exports = async function(config) {
  let {port} = await protractorUtils.runServer(config.workspace, config.server, '-port', []);
  let serverUrl = `http://localhost:${port}`;

  protractor.browser.baseUrl = serverUrl;
};
