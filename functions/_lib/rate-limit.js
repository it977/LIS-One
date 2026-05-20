const buckets = new Map();

function now() {
  return Date.now();
}

function headerValue(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || '';
  const key = name.toLowerCase();
  return headers[key] || headers[name] || '';
}

export function getClientIp(request) {
  const headers = request?.headers;
  const forwarded = headerValue(headers, 'x-forwarded-for');
  return (
    headerValue(headers, 'cf-connecting-ip') ||
    forwarded.split(',')[0]?.trim() ||
    headerValue(headers, 'x-real-ip') ||
    headerValue(headers, 'true-client-ip') ||
    'unknown'
  );
}

export function checkRateLimit(key, { limit = 5, windowMs = 600000 } = {}) {
  const ts = now();
  const bucket = buckets.get(key) || { count: 0, resetAt: ts + windowMs };
  if (ts > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = ts + windowMs;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  const remaining = Math.max(0, limit - bucket.count);
  const allowed = bucket.count <= limit;
  return {
    allowed,
    limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - ts) / 1000)),
  };
}

export function pruneRateLimitBuckets(maxAgeMs = 24 * 60 * 60 * 1000) {
  const ts = now();
  for (const [key, bucket] of buckets.entries()) {
    if (!bucket || ts - bucket.resetAt > maxAgeMs) buckets.delete(key);
  }
}
