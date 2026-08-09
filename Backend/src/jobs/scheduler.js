'use strict';

const logger = require('../observability/logger');
const metrics = require('../observability/metrics');

function createJobScheduler({ db, now, id, audit, saveState, releaseEscrowForOrderItem, syncOrderEscrowStatus, reconciliationForDate }) {
  const timers = [];

  async function runJob(name, fn) {
    const started = Date.now();
    try {
      const result = await fn();
      metrics.recordJob(name, 'ok', Date.now() - started);
      logger.info('job.completed', { job: name, result });
      return result;
    } catch (error) {
      metrics.recordJob(name, 'failed', Date.now() - started);
      logger.error('job.failed', { job: name, error: error.message });
      throw error;
    }
  }

  function autoReleaseEscrow() {
    return runJob('escrow_auto_release', async () => {
      const days = Number(db.meta.escrowAutoReleaseDays || 7);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      let released = 0;
      for (const item of db.orderItems.filter((candidate) => candidate.status === 'delivered' && candidate.escrowStatus === 'held')) {
        const deliveredAt = new Date(item.deliveredAt || item.updatedAt || item.createdAt).getTime();
        if (deliveredAt <= cutoff && releaseEscrowForOrderItem(item, 'system')) released += 1;
      }
      for (const order of db.orders) syncOrderEscrowStatus(order.id);
      if (released) {
        audit('system', 'job_auto_release_escrow', 'job', id('job'), { released });
        saveState(db);
      }
      return { released };
    });
  }

  function dailyReconciliation() {
    return runJob('daily_reconciliation', async () => {
      const date = new Date().toISOString().slice(0, 10);
      const reconciliation = reconciliationForDate(date);
      db.reconciliationSnapshots = db.reconciliationSnapshots || [];
      db.reconciliationSnapshots.push({ id: id('rec'), date, reconciliation, createdAt: now() });
      saveState(db);
      return { date, entryCount: reconciliation.entryCount };
    });
  }

  function start() {
    if (process.env.NODE_ENV === 'test' || process.env.EXPOCRAFT_JOBS === 'false') return;
    timers.push(setInterval(autoReleaseEscrow, Number(process.env.ESCROW_JOB_INTERVAL_MS || 60 * 60 * 1000)));
    timers.push(setInterval(dailyReconciliation, Number(process.env.RECONCILIATION_JOB_INTERVAL_MS || 24 * 60 * 60 * 1000)));
    logger.info('jobs.started', { count: timers.length });
  }

  function stop() {
    while (timers.length) clearInterval(timers.pop());
  }

  return { start, stop, autoReleaseEscrow, dailyReconciliation };
}

module.exports = { createJobScheduler };
