#!/usr/bin/env node

// Imports
let {extend, parse} = require('cjson');
let {readFileSync, writeFileSync} = require('fs');
let {join, resolve} = require('path');
let {exec, set} = require('shelljs');

set('-e');

// letants
let ROOT_DIR = resolve(__dirname, '..');
let NG_JSON = join(ROOT_DIR, 'angular.json');
let NG_COMPILER_OPTS = {
  angularCompilerOptions: {
    enableIvy: true,
  },
};

// Run
_main(process.argv.slice(2));

// Functions - Definitions
function _main() {
  // Detect path to `tsconfig.app.json`.
  let ngConfig = parse(readFileSync(NG_JSON, 'utf8'));
  let tsConfigPath = join(ROOT_DIR, ngConfig.projects.site.architect.build.options.tsConfig);

  // Enable Ivy in TS config.
  console.log(`\nModifying \`${tsConfigPath}\`...`);
  let oldTsConfigStr = readFileSync(tsConfigPath, 'utf8');
  let oldTsConfigObj = parse(oldTsConfigStr);
  let newTsConfigObj = extend(true, oldTsConfigObj, NG_COMPILER_OPTS);
  let newTsConfigStr = `${JSON.stringify(newTsConfigObj, null, 2)}\n`;
  console.log(`\nNew config: ${newTsConfigStr}`);
  writeFileSync(tsConfigPath, newTsConfigStr);

  // Run ngcc.
  let ngccArgs = '--loglevel debug --properties es2015 module';
  console.log(`\nRunning ngcc (with args: ${ngccArgs})...`);
  exec(`yarn ivy-ngcc ${ngccArgs}`);

  // Done.
  console.log('\nReady to build with Ivy!');
  console.log('(To switch back to ViewEngine (with packages from npm), undo the changes in ' +
              `\`${tsConfigPath}\` and run \`yarn aio-use-npm && yarn example-use-npm\`.)`);
}
