import 'server-only';
import { fetchBestOriginalTenji } from './verifiedOriginalTenjiSource';
import { trackExhibitionFetch } from './exhibitionAcquisitionTelemetry';

// Only production collectors use this wrapper. Read-only diagnostic endpoints stay read-only.
export function fetchTrackedOriginalTenji(client, consumer, race, options = {}) {
  return trackExhibitionFetch(client, consumer, race, fetchBestOriginalTenji, options);
}
