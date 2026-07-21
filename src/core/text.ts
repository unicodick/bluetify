import {
  BLUESKY_BIO_MAX_BYTES,
  BLUESKY_BIO_MAX_LENGTH,
} from './constants.js';

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
});
const textEncoder = new TextEncoder();

export function truncateBlueskyDescription(value: string): string {
  let result = '';
  let graphemeCount = 0;
  let byteCount = 0;

  for (const { segment } of graphemeSegmenter.segment(value)) {
    const segmentBytes = textEncoder.encode(segment).byteLength;
    if (
      graphemeCount >= BLUESKY_BIO_MAX_LENGTH ||
      byteCount + segmentBytes > BLUESKY_BIO_MAX_BYTES
    ) {
      break;
    }

    result += segment;
    graphemeCount += 1;
    byteCount += segmentBytes;
  }

  return result;
}
