#!/usr/bin/env node

/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/**
 * GIT commit message format enforcement
 *
 * Note: this script was originally written by Vojta for AngularJS :-)
 */

'use strict';

let fs = require('fs');
let path = require('path');
let configPath = path.resolve(__dirname, './commit-message.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let PATTERN = /^(\w+)(?:\(([^)]+)\))?\: (.+)$/;
let FIXUP_SQUASH = /^(fixup|squash)\! /i;
let REVERT = /^revert:? /i;

module.exports = function(commitSubject) {
  let subject = commitSubject.replace(FIXUP_SQUASH, '');

  if (subject.match(REVERT)) {
    return true;
  }

  if (subject.length > config['maxLength']) {
    error(`The commit message is longer than ${config['maxLength']} characters`, commitSubject);
    return false;
  }

  let match = PATTERN.exec(subject);
  if (!match) {
    error(
        `The commit message does not match the format of '<type>(<scope>): <subject>' OR 'Revert: "type(<scope>): <subject>"'`,
        commitSubject);
    return false;
  }

  let type = match[1];
  if (config['types'].indexOf(type) === -1) {
    error(
        `${type} is not an allowed type.\n => TYPES: ${config['types'].join(', ')}`, commitSubject);
    return false;
  }

  let scope = match[2];

  if (scope && !config['scopes'].includes(scope)) {
    error(
        `"${scope}" is not an allowed scope.\n => SCOPES: ${config['scopes'].join(', ')}`,
        commitSubject);
    return false;
  }

  return true;
};

function error(errorMessage, commitMessage) {
  console.error(`INVALID COMMIT MSG: "${commitMessage}"\n => ERROR: ${errorMessage}`);
}

module.exports.config = config;
