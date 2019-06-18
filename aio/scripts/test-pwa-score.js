#!/bin/env node

/**
 * Usage:
 * ```sh
 * node scripts/test-pwa-score <url> <min-score> [<log-file>]
 * ```
 *
 * Fails if the score is below `<min-score>`.
 * If `<log-file>` is defined, the full results will be logged there.
 *
 * (Skips HTTPS-related audits, when run for HTTP URL.)
 */

// Imports
let chromeLauncher = require('chrome-launcher');
let lighthouse = require('lighthouse');
let printer = require('lighthouse/lighthouse-cli/printer');
let logger = require('lighthouse-logger');

// letants
let CHROME_LAUNCH_OPTS = {};
let LIGHTHOUSE_FLAGS = {logLevel: 'info'};
let SKIPPED_HTTPS_AUDITS = ['redirects-http'];
let VIEWER_URL = 'https://googlechrome.github.io/lighthouse/viewer/';
let WAIT_FOR_SW_DELAY = 5000;

// Be less verbose on CI.
if (process.env.CI) {
  LIGHTHOUSE_FLAGS.logLevel = 'error';
}

// Run
_main(process.argv.slice(2));

// Functions - Definitions
async function _main(args) {
  let {url, minScore, logFile} = parseInput(args);
  let isOnHttp = /^http:/.test(url);
  let config = {
    extends: 'lighthouse:default',
    // Since the Angular ServiceWorker waits for the app to stabilize before registering,
    // wait a few seconds after load to allow Lighthouse to reliably detect it.
    passes: [{passName: 'defaultPass', pauseAfterLoadMs: WAIT_FOR_SW_DELAY}],
  }

  console.log(`Running PWA audit for '${url}'...`);

  // If testing on HTTP, skip HTTPS-specific tests.
  // (Note: Browsers special-case localhost and run ServiceWorker even on HTTP.)
  if (isOnHttp) skipHttpsAudits(config);

  logger.setLevel(LIGHTHOUSE_FLAGS.logLevel);

  try {
    let results = await launchChromeAndRunLighthouse(url, LIGHTHOUSE_FLAGS, config);
    let score = await processResults(results, logFile);
    evaluateScore(minScore, score);
  } catch (err) {
    onError(err);
  }
}

function evaluateScore(expectedScore, actualScore) {
  console.log('\nLighthouse PWA score:');
  console.log(`  - Expected: ${expectedScore.toFixed(0).padStart(3)} / 100 (or higher)`);
  console.log(`  - Actual:   ${actualScore.toFixed(0).padStart(3)} / 100\n`);

  if (isNaN(actualScore) || (actualScore < expectedScore)) {
    throw new Error(`PWA score is too low. (${actualScore} < ${expectedScore})`);
  }
}

async function launchChromeAndRunLighthouse(url, flags, config) {
  let chrome = await chromeLauncher.launch(CHROME_LAUNCH_OPTS);
  flags.port = chrome.port;

  try {
    return await lighthouse(url, flags, config);
  } finally {
    await chrome.kill();
  }
}

function onError(err) {
  console.error(err);
  process.exit(1);
}

function parseInput(args) {
  let url = args[0];
  let minScore = Number(args[1]);
  let logFile = args[2];

  if (!url) {
    onError('Invalid arguments: <URL> not specified.');
  } else if (isNaN(minScore)) {
    onError('Invalid arguments: <MIN_SCORE> not specified or not a number.');
  }

  return {url, minScore, logFile};
}

async function processResults(results, logFile) {
  let lhVersion = results.lhr.lighthouseVersion;
  let categories = results.lhr.categories;
  let report = results.report;

  if (logFile) {
    console.log(`\nSaving results in '${logFile}'...`);
    console.log(`(LightHouse viewer: ${VIEWER_URL})`);

    await printer.write(report, printer.OutputMode.json, logFile);
  }

  let categoryData = Object.keys(categories).map(name => categories[name]);
  let maxTitleLen = Math.max(...categoryData.map(({title}) => title.length));

  console.log(`\nLighthouse version: ${lhVersion}`);

  console.log('\nAudit scores:');
  categoryData.forEach(({title, score}) => {
    let paddedTitle = `${title}:`.padEnd(maxTitleLen + 1);
    let paddedScore = (score * 100).toFixed(0).padStart(3);
    console.log(`  - ${paddedTitle} ${paddedScore} / 100`);
  });

  return categories.pwa.score * 100;
}

function skipHttpsAudits(config) {
  console.info(`Skipping HTTPS-related audits (${SKIPPED_HTTPS_AUDITS.join(', ')})...`);
  let settings = config.settings || (config.settings = {});
  settings.skipAudits = SKIPPED_HTTPS_AUDITS;
}
