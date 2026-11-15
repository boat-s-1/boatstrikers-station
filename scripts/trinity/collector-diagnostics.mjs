// Only stable stages/statuses are logged. Never log HTML, bearer values, URLs or raw errors.
const stages = new Set(['official_index', 'official_race', 'parse', 'intake_fetch', 'intake_decode', 'intake_status']);
export function collectorDiagnostic(stage, error, status) {
  status ??= error?.status;
  return { stage: stages.has(stage) ? stage : 'unknown',
    failure: error?.name === 'TimeoutError' ? 'timeout' : error?.code === 'OFFICIAL_RACELIST_INCOMPLETE' ? 'source_incomplete' : 'failure',
    ...(Number.isInteger(status) && status >= 100 && status <= 599 ? { http_status: status } : {}) };
}
