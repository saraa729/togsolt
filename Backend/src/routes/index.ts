'use strict';

const registerAuth = require('./auth');
const registerDiscovery = require('./discovery');
const registerCatalog = require('./catalog');
const registerOrders = require('./orders');
const registerCustomTrust = require('./custom-trust');
const registerPhase2 = require('./phase2');
const registerAdmin = require('./admin');
const registerUploads = require('./uploads');

module.exports = function registerRoutes(ctx) {
  registerAuth(ctx);
  registerDiscovery(ctx);
  registerCatalog(ctx);
  registerOrders(ctx);
  registerCustomTrust(ctx);
  registerPhase2(ctx);
  registerAdmin(ctx);
  registerUploads(ctx);
};
