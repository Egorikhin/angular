let path = require('path');
let StackblitzBuilder = require('./builder');

let EXAMPLES_PATH = path.join(__dirname, '../../content/examples');
let LIVE_EXAMPLES_PATH = path.join(__dirname, '../../src/generated/live-examples');

new StackblitzBuilder(EXAMPLES_PATH, LIVE_EXAMPLES_PATH).build();

