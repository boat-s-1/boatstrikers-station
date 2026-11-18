// Offline validation of the documented asynchronous BRDB-API response codes.
// No credentials, endpoints, network calls or provider CSV data are handled here.
export function classifyBrdbJob(status) {
  if (status?.ret == null || status?.ret1 == null || status.ret === '' || status.ret1 === '') return 'STOP_INVALID_RESPONSE';
  const overall = Number(status?.ret);
  const individual = Number(status?.ret1);
  if (!Number.isInteger(overall) || !Number.isInteger(individual)) return 'STOP_INVALID_RESPONSE';
  if (overall !== 0) return 'STOP_PROVIDER_ERROR';
  switch (individual) {
    case 0: case 1: return 'WAIT_BOUNDED';
    case 2: return 'READY_FOR_GETURL';
    case 4: case 6: case 8: case 9: return 'STOP_JOB_FAILED';
    default: return 'STOP_UNKNOWN_STATUS';
  }
}
