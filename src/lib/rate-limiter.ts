interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const ipBuckets = new Map<string, TokenBucket>();

// Configuration: max 5 requests, refilling 1 request every 10 seconds (10000 ms)
const MAX_TOKENS = 5;
const REFILL_INTERVAL = 10000; // Refill 1 token every 10s
const REFILL_AMOUNT = 1;

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let bucket = ipBuckets.get(ip);

  if (!bucket) {
    bucket = { tokens: MAX_TOKENS, lastRefill: now };
    ipBuckets.set(ip, bucket);
  } else {
    // Calculate how many tokens should be added since last refill
    const elapsed = now - bucket.lastRefill;
    if (elapsed >= REFILL_INTERVAL) {
      const tokensToAdd = Math.floor(elapsed / REFILL_INTERVAL) * REFILL_AMOUNT;
      bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now - (elapsed % REFILL_INTERVAL); // carry over partial interval
    }
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: bucket.tokens };
  }

  return { allowed: false, remaining: 0 };
}
