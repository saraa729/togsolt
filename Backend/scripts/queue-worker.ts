'use strict';

require('dotenv').config();

const { jobs, queue } = require('../app');

const DEFAULT_INTERVAL_MS = 60 * 1000;

async function tick() {
  await jobs.dailyReconciliation();
  await jobs.autoReleaseEscrow();
}

async function main() {
  const intervalMs = Number(process.env.EXPOCRAFT_WORKER_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  console.log(`[worker:start] queue=${queue.provider} intervalMs=${intervalMs}`);

  await tick();
  setInterval(() => {
    tick().catch((error: Error) => {
      console.error(`[worker:error] ${error.message}`);
      process.exitCode = 1;
    });
  }, intervalMs);
}

main().catch((error: Error) => {
  console.error(`[worker:error] ${error.message}`);
  process.exit(1);
});
