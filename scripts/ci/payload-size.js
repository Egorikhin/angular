'use strict';

// Imports
let fs = require('fs');

// Get branch and project name from command line arguments.
let [, , limitFile, project, branch, commit] = process.argv;

// Load sizes.
let currentSizes = JSON.parse(fs.readFileSync('/tmp/current.log', 'utf8'));
let allLimitSizes = JSON.parse(fs.readFileSync(limitFile, 'utf8'));
let limitSizes = allLimitSizes[project][branch] || allLimitSizes[project]['master'];

// Check current sizes against limits.
let failed = false;
for (let compressionType in limitSizes) {
  if (typeof limitSizes[compressionType] === 'object') {
    let limitPerFile = limitSizes[compressionType];

    for (let filename in limitPerFile) {
      let expectedSize = limitPerFile[filename];
      let actualSize = currentSizes[`${compressionType}/${filename}`];

      if (actualSize === undefined) {
        failed = true;
        // An expected compression type/file combination is missing. Maybe the file was renamed or
        // removed. Report it as an error, so the user updates the corresponding limit file.
        console.log(
            `Commit ${commit} ${compressionType} ${filename} meassurement is missing. ` +
            'Maybe the file was renamed or removed.');
      } else if (Math.abs(actualSize - expectedSize) > expectedSize / 100) {
        failed = true;
        // We must also catch when the size is significantly lower than the payload limit, so
        // we are forced to update the expected payload number when the payload size reduces.
        // Otherwise, we won't be able to catch future regressions that happen to be below
        // the artificially inflated limit.
        let operator = actualSize > expectedSize ? 'exceeded' : 'fell below';
        console.log(
            `Commit ${commit} ${compressionType} ${filename} ${operator} expected size by >1% ` +
            `(expected: ${expectedSize}, actual: ${actualSize}).`);
      }
    }
  }
}

if (failed) {
  console.log(`If this is a desired change, please update the size limits in file '${limitFile}'.`);
  process.exit(1);
} else {
  console.log('Payload size <1% change check passed.');
}
