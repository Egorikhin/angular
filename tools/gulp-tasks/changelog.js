/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

module.exports = (gulp) => () => {
  let conventionalChangelog = require('gulp-conventional-changelog');
  let ignoredScopes = [
    'aio',
    'docs-infra',
    'ivy',
  ];

  return gulp.src('CHANGELOG.md')
      .pipe(conventionalChangelog({preset: 'angular'}, {}, {
        // Ignore commits that start with `<type>(<scope>)` for any of the ignored scopes.
        extendedRegexp: true,
        grep: `^[^(]+\\((${ignoredScopes.join('|')})\\)`,
        invertGrep: true,
      }))
      .pipe(gulp.dest('./'));
};
