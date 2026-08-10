'use strict';

let start;
let app;

try {
  ({ start } = require('./dist/src/bootstrap/server'));
  app = require('./dist/src/app');
} catch (error) {
  if (error && error.code === 'MODULE_NOT_FOUND') {
    throw new Error('Compiled backend was not found. Run `npm run build` before `node app.js`.');
  }
  throw error;
}

if (require.main === module) {
  start();
}

module.exports = app;
