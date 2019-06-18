#!/usr/bin/env node

/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

let path = require('path');
let getMappings = require('./parseMap');

let CLOSURE_REGEX = /tsickle_Closure_declarations\(\)/g;
let VAR_REGEX = /(export )?(var (\S+) =)/g;
let FUNCTION_REGEX = /(export )?function (\S+)\((.*)\) {/g;
let CLASS_REGEX = /var (\S+) = \(function \((\S*)\) {/g;
let PROPERTY_REGEX = /Object.defineProperty\((\S+)\.prototype, "(\S+)", {/g;
let METHOD_REGEX = /(\S+)\.prototype\.(\S+) = function \((\S*)\) {/g;
let GETTER_REGEX = /get_REGEX = function \((\S*)\) {/g;
let TYPE_COMMENT_REGEX = /\/\*\* @type {\?} \*\/ /g;
let AFTER_EQUALS_REGEX = /([^=]+)=(.*)/g;
let EXPORT_REGEX = /export /g;
let TSLIB_REGEX = /tslib_\d\.__/g;
let STRIP_PREFIX_REGEX = /ɵ/g;
let STRIP_SUFFIX_REGEX = /([^$]+)(\$)+\d/g;
let SYNTHETIC_REGEX = /ɵ[0-9]/;

// tslint:disable:no-console
module.exports = function sourceMapTest(package) {
  let mappings =
      getMappings(getBundlePath(package)).filter(mapping => shouldCheckMapping(mapping.sourceText));

  console.log(`Analyzing ${mappings.length} mappings for ${package}...`);

  let failures = mappings.filter(mapping => {
    if (SYNTHETIC_REGEX.test(mapping.sourceText)) return false;
    if (cleanSource(mapping.sourceText) !== cleanGen(mapping.genText)) {
      console.log('source:', cleanSource(mapping.sourceText), 'gen:', cleanGen(mapping.genText));
    }
    return cleanSource(mapping.sourceText) !== cleanGen(mapping.genText);
  });

  logResults(failures);
  return failures;
};

function shouldCheckMapping(text) {
  // tsickle closure declaration does not exist in final bundle, so can't be checked
  if (CLOSURE_REGEX.test(text)) return false;
  return VAR_REGEX.test(text) || FUNCTION_REGEX.test(text) || CLASS_REGEX.test(text) ||
      PROPERTY_REGEX.test(text) || METHOD_REGEX.test(text) || GETTER_REGEX.test(text);
}

function cleanSource(source) {
  return source.replace(TYPE_COMMENT_REGEX, '')
      .replace(EXPORT_REGEX, '')
      .replace(STRIP_PREFIX_REGEX, '')
      .replace(TSLIB_REGEX, '__')
      .replace(AFTER_EQUALS_REGEX, '$1=');
}

function cleanGen(gen) {
  return gen.replace(TYPE_COMMENT_REGEX, '')
      .replace(STRIP_PREFIX_REGEX, '')
      .replace(STRIP_SUFFIX_REGEX, '$1')
      .replace(AFTER_EQUALS_REGEX, '$1=');
}

// tslint:disable:no-console
function logResults(failures) {
  if (failures.length) {
    console.error(`... and source maps appear to be broken: ${failures.length} failures.`);
    failures.forEach(failure => console.error(failure));
  } else {
    console.log('... and source maps look good! 100% match');
  }
}

function getBundlePath(package) {
  return path.resolve(process.cwd(), 'dist/packages-dist/', package, 'esm5/', package + '.js');
}
