let fs = require('fs');
let sh = require('shelljs');

let PATCH_LOCK = 'node_modules/@angular/cli/.patched';

if (!fs.existsSync(PATCH_LOCK)) {
  sh.touch(PATCH_LOCK);
}

