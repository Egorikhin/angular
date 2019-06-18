let {resolve} = require('canonical-path');
let sh = require('shelljs');
let {CONTENTS_PATH} = require('../config');

let cliGitRef = process.argv[2] || 'master';  // Can be a branch, commit or tag.
let pkgContent = JSON.stringify({
  dependencies: {
    '@angular/cli': `https://github.com/angular/cli-builds#${cliGitRef}`,
  },
}, null, 2);

sh.set('-e');
sh.cd(resolve(CONTENTS_PATH, 'cli-src'));
sh.exec('git clean -Xfd');
sh.echo(pkgContent).to('package.json');
sh.exec('yarn install --no-lockfile --non-interactive');
