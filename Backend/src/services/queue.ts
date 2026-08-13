'use strict';

const logger = require('../observability/logger');

type QueueJob = {
  id: string;
  name: string;
  payload: unknown;
  availableAt: number;
  attempts: number;
  createdAt: string;
};

function createLocalQueue() {
  const jobs: QueueJob[] = [];
  return {
    provider: 'local',
    async enqueue(name: string, payload: unknown = {}, options: { delayMs?: number } = {}) {
      const job = {
        id: `job_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        name,
        payload,
        availableAt: Date.now() + Number(options.delayMs || 0),
        attempts: 0,
        createdAt: new Date().toISOString()
      };
      jobs.push(job);
      logger.info('queue.enqueued', { provider: 'local', job: name, id: job.id });
      return job;
    },
    async drain(name: string, handler: (payload: unknown, job: QueueJob) => Promise<unknown>) {
      const ready = jobs.filter((job) => job.name === name && job.availableAt <= Date.now());
      for (const job of ready) {
        const index = jobs.indexOf(job);
        if (index !== -1) jobs.splice(index, 1);
        job.attempts += 1;
        await handler(job.payload, job);
      }
      return { processed: ready.length };
    },
    async size(name?: string) {
      return name ? jobs.filter((job) => job.name === name).length : jobs.length;
    }
  };
}

function createRabbitMqQueue(url: string) {
  return {
    provider: 'rabbitmq',
    url,
    async enqueue(name: string) {
      /*
       * AMQP publishing is intentionally owned by the worker image. The web app
       * validates config and exposes provider state, while background execution
       * remains inline unless a worker service is deployed.
       */
      throw new Error(`RabbitMQ queue "${name}" requires the worker service to be deployed.`);
    },
    async drain() {
      return { processed: 0 };
    },
    async size() {
      return null;
    }
  };
}

function createQueueService() {
  const provider = String(process.env.EXPOCRAFT_QUEUE_PROVIDER || 'local').toLowerCase();
  if (provider === 'rabbitmq') {
    if (!process.env.RABBITMQ_URL) throw new Error('RABBITMQ_URL is required when EXPOCRAFT_QUEUE_PROVIDER=rabbitmq.');
    return createRabbitMqQueue(process.env.RABBITMQ_URL);
  }
  return createLocalQueue();
}

module.exports = { createQueueService, createLocalQueue, createRabbitMqQueue };
