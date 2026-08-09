'use strict';

const metrics = {
  httpRequests: 0,
  httpErrors: 0,
  routeCounts: {},
  jobs: {},
  startedAt: new Date().toISOString()
};

function recordRequest(method, path, status, durationMs) {
  metrics.httpRequests += 1;
  if (status >= 400) metrics.httpErrors += 1;
  const key = `${method} ${path}`;
  metrics.routeCounts[key] = metrics.routeCounts[key] || { count: 0, errors: 0, totalDurationMs: 0 };
  metrics.routeCounts[key].count += 1;
  metrics.routeCounts[key].totalDurationMs += durationMs;
  if (status >= 400) metrics.routeCounts[key].errors += 1;
}

function recordJob(name, status, durationMs) {
  metrics.jobs[name] = metrics.jobs[name] || { runs: 0, failures: 0, lastRunAt: null, lastDurationMs: 0 };
  metrics.jobs[name].runs += 1;
  metrics.jobs[name].lastRunAt = new Date().toISOString();
  metrics.jobs[name].lastDurationMs = durationMs;
  if (status === 'failed') metrics.jobs[name].failures += 1;
}

function snapshot() {
  return { ...metrics, uptimeSeconds: Math.round(process.uptime()) };
}

function prometheus() {
  const lines = [
    '# HELP expocraft_http_requests_total Total HTTP requests.',
    '# TYPE expocraft_http_requests_total counter',
    `expocraft_http_requests_total ${metrics.httpRequests}`,
    '# HELP expocraft_http_errors_total Total HTTP errors.',
    '# TYPE expocraft_http_errors_total counter',
    `expocraft_http_errors_total ${metrics.httpErrors}`,
    '# HELP expocraft_uptime_seconds Process uptime.',
    '# TYPE expocraft_uptime_seconds gauge',
    `expocraft_uptime_seconds ${Math.round(process.uptime())}`
  ];
  for (const [route, value] of Object.entries(metrics.routeCounts)) {
    const [method, ...pathParts] = route.split(' ');
    const path = pathParts.join(' ');
    lines.push(`expocraft_route_requests_total{method="${method}",route="${path}"} ${value.count}`);
    lines.push(`expocraft_route_errors_total{method="${method}",route="${path}"} ${value.errors}`);
    lines.push(`expocraft_route_duration_ms_sum{method="${method}",route="${path}"} ${value.totalDurationMs}`);
  }
  for (const [job, value] of Object.entries(metrics.jobs)) {
    lines.push(`expocraft_job_runs_total{job="${job}"} ${value.runs}`);
    lines.push(`expocraft_job_failures_total{job="${job}"} ${value.failures}`);
    lines.push(`expocraft_job_last_duration_ms{job="${job}"} ${value.lastDurationMs}`);
  }
  return `${lines.join('\n')}\n`;
}

module.exports = { recordRequest, recordJob, snapshot, prometheus };
