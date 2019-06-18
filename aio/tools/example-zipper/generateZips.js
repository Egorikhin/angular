let ExampleZipper = require('./exampleZipper');
let path = require('canonical-path');

let EXAMPLES_PATH = path.join(__dirname, '../../content/examples');
let ZIPS_PATH = path.join(__dirname, '../../src/generated/zips');

new ExampleZipper(EXAMPLES_PATH, ZIPS_PATH);
