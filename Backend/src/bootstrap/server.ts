'use strict';

const http = require('http');
const { app, jobs, realtime } = require('../app');
const { PORT } = require('../config/constants');

function start(port = PORT) {
  const server = http.createServer(app);
  realtime.attach(server);
  const listenOnPort = (candidatePort) => {
    const onError = (error) => {
      if ((error.code === 'EADDRINUSE' || error.code === 'EPERM') && candidatePort < 4100) {
        console.warn(`Port ${candidatePort} is unavailable. Trying ${candidatePort + 1} instead.`);
        server.removeListener('error', onError);
        listenOnPort(candidatePort + 1);
        return;
      }
      throw error;
    };

    server.once('error', onError);
    server.listen(candidatePort, () => {
      server.removeListener('error', onError);
      console.log(`ExpoCraft backend listening on http://localhost:${candidatePort}`);
      jobs.start();
    });
  };

  listenOnPort(port);
  server.on('close', () => jobs.stop());
  return server;
}

module.exports = { start };
