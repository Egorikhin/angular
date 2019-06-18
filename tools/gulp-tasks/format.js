/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

let {I18N_FOLDER, I18N_DATA_FOLDER} = require('./cldr/extract');

// clang-format entry points
let srcsToFmt = [
  'packages/**/*.{js,ts}',
  'modules/benchmarks/**/*.{js,ts}',
  'modules/e2e_util/**/*.{js,ts}',
  'modules/playground/**/*.{js,ts}',
  'tools/**/*.{js,ts}',
  '!tools/public_api_guard/**/*.d.ts',
  './*.{js,ts}',
  '!**/node_modules/**',
  '!**/dist/**',
  '!**/built/**',
  '!shims_for_IE.js',
  `!${I18N_DATA_FOLDER}/**/*.{js,ts}`,
  `!${I18N_FOLDER}/available_locales.ts`,
  `!${I18N_FOLDER}/currencies.ts`,
  `!${I18N_FOLDER}/locale_en.ts`,
  '!tools/gulp-tasks/cldr/extract.js',
  '!tools/ts-api-guardian/test/fixtures/**',
];

/**
 * Gulp stream that wraps the gulp-git status,
 * only returns untracked files, and converts
 * the stdout into a stream of files.
 */
function gulpStatus() {
  let Vinyl = require('vinyl');
  let path = require('path');
  let gulpGit = require('gulp-git');
  let through = require('through2');
  let srcStream = through.obj();

  let opt = {cwd: process.cwd()};

  // https://git-scm.com/docs/git-status#_short_format
  let RE_STATUS = /((\s\w)|(\w+)|\?{0,2})\s([\w\+\-\/\\\.]+)(\s->\s)?([\w\+\-\/\\\.]+)*\n{0,1}/gm;

  gulpGit.status({args: '--porcelain', quiet: true}, function(err, stdout) {
    if (err) return srcStream.emit('error', err);

    let data = stdout.toString();
    let currentMatch;

    while ((currentMatch = RE_STATUS.exec(data)) !== null) {
      // status
      let status = currentMatch[1].trim().toLowerCase();

      // We only care about untracked files and renamed files
      if (!new RegExp(/r|\?/i).test(status)) {
        continue;
      }

      // file path
      let currentFilePath = currentMatch[4];

      // new file path in case its been moved
      let newFilePath = currentMatch[6];
      let filePath = newFilePath || currentFilePath;

      srcStream.write(new Vinyl({
        path: path.resolve(opt.cwd, filePath),
        cwd: opt.cwd,
      }));

      RE_STATUS.lastIndex++;
    }

    srcStream.end();
  });

  return srcStream;
}

module.exports = {
  // Check source code for formatting errors (clang-format)
  enforce: (gulp) => () => {
    let format = require('gulp-clang-format');
    let clangFormat = require('clang-format');
    return gulp.src(srcsToFmt).pipe(
        format.checkFormat('file', clangFormat, {verbose: true, fail: true}));
  },

  // Format the source code with clang-format (see .clang-format)
  format: (gulp) => () => {
    let format = require('gulp-clang-format');
    let clangFormat = require('clang-format');
    return gulp.src(srcsToFmt, {base: '.'})
        .pipe(format.format('file', clangFormat))
        .pipe(gulp.dest('.'));
  },

  // Format only the untracked source code files with clang-format (see .clang-format)
  'format-untracked': (gulp) => () => {
    let format = require('gulp-clang-format');
    let clangFormat = require('clang-format');
    let gulpFilter = require('gulp-filter');

    return gulpStatus()
        .pipe(gulpFilter(srcsToFmt))
        .pipe(format.format('file', clangFormat))
        .pipe(gulp.dest('.'));
  },

  // Format only the changed source code files diffed from the provided branch with clang-format
  // (see .clang-format)
  'format-diff': (gulp) => () => {
    let format = require('gulp-clang-format');
    let clangFormat = require('clang-format');
    let gulpFilter = require('gulp-filter');
    let minimist = require('minimist');
    let gulpGit = require('gulp-git');

    let args = minimist(process.argv.slice(2));
    let branch = args.branch || 'master';

    return gulpGit.diff(branch, {log: false})
        .pipe(gulpFilter(srcsToFmt))
        .pipe(format.format('file', clangFormat))
        .pipe(gulp.dest('.'));
  }
};
