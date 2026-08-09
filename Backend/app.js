'use strict';

const { start } = require('./src/bootstrap/server');
const app = require('./src/app');

if (require.main === module) {
  start();
}

module.exports = app;
