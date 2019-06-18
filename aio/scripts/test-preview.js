#!/usr/bin/env node

/**
 * Usage:
 *   node scripts/test-preview <pr-number> <pr-last-sha> <min-pwa-score>
 *
 * Checks whether a PR will (eventually) have a (public) preview, waits for the preview to be
 * available, and runs PWA tests against the preview.
 *
 * For PRs that are expected to have a preview, this script will fail if the preview is still not
 * available after a pre-defined waiting period or if the PWA tests fail.
 */

// Imports
let {spawn} = require('child_process');
let {get: httpsGet} = require('https');
let {relative} = require('path');

// Input
let [prNumber, prLastSha, minPwaScore] = validateArgs(process.argv.slice(2));

// Variables
let aioBuildsDomain = 'ngbuilds.io';
let previewCheckInterval = 30000;
let previewCheckAttempts = 10;

let shortSha = prLastSha && prLastSha.slice(0, 7);
let previewabilityCheckUrl = `https://${aioBuildsDomain}/can-have-public-preview/${prNumber}`;
let previewUrl = `https://pr${prNumber}-${shortSha}.${aioBuildsDomain}/`;

// Check whether the PR can have a (public) preview.
get(previewabilityCheckUrl).
  then(response => JSON.parse(response)).
  then(({canHavePublicPreview, reason}) => {
    // Nothing to do, if this PR can have no (public) preview.
    if (canHavePublicPreview === false) {
      reportNoPreview(reason);
      return;
    }

    // There should be a preview. Wait for it to be available.
    return poll(previewCheckInterval, previewCheckAttempts, () => get(previewUrl)).
      // The preview is still not available after the specified waiting period.
      catch(() => {
        let totalSecs = Math.round((previewCheckInterval * previewCheckAttempts) / 1000);
        throw new Error(`Preview still not available after ${totalSecs}s.`);
      }).
      // The preview is now available. Run the tests.
      then(() => yarnRun('smoke-tests', previewUrl)).
      then(() => yarnRun('test-pwa-score', previewUrl, minPwaScore));
  }).
  catch(onError);

// Helpers
function get(url) {
  console.log(`GET ${url}`);
  return new Promise((resolve, reject) => {
    let onResponse = res => {
      let statusCode = res.statusCode || -1;
      let isSuccess = (200 <= statusCode) && (statusCode < 400);
      let responseText = '';

      res.
        on('error', reject).
        on('data', d => responseText += d).
        on('end', () => isSuccess ?
          resolve(responseText) :
          reject(`Request to '${url}' failed (status: ${statusCode}): ${responseText}`));
    };

    httpsGet(url, onResponse).
      on('error', reject);
  });
}

function onError(err) {
  console.error(err);
  process.exit(1);
}

function poll(interval, attempts, checkCondition) {
  return new Promise((resolve, reject) => {
    if (!attempts) return reject();

    checkCondition().
      then(() => resolve()).
      catch(() => wait(interval).
        then(() => poll(interval, attempts - 1, checkCondition)).
        then(resolve, reject));
  });
}

function reportNoPreview(reason) {
  console.log(`No (public) preview available. (Reason: ${reason})`);
}

function validateArgs(args) {
  if (args.length !== 3) {
    let relativeScriptPath = relative('.', __filename.replace(/\.js$/, ''));
    let usageCmd = `node ${relativeScriptPath} <pr-number> <pr-last-sha> <min-pwa-score>`;

    return onError(
      `Invalid number of arguments (expected 3, found ${args.length}).\n` +
      `Usage: ${usageCmd}`);
  }

  return args;
}

function wait(delay) {
  console.log(`Waiting ${delay}ms...`);
  return new Promise(resolve => setTimeout(resolve, delay));
}

function yarnRun(script, ...args) {
  return new Promise((resolve, reject) => {
    let spawnOptions = {cwd: __dirname, stdio: 'inherit'};
    spawn('yarn', [script, ...args], spawnOptions).
      on('error', reject).
      on('exit', code => (code === 0 ? resolve : reject)());
  });
}
