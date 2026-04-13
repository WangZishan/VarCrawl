/**
 * Tiny Upstash Redis REST wrapper. No-op if the env vars aren't set, so local
 * dev works without any external deps.
 */

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const enabled = !!(URL && TOKEN);

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!enabled) return null;
  try {
    const res = await fetch(`${URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result: string | null };
    if (!data.result) return null;
    return JSON.parse(data.result) as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSec = 86400): Promise<void> {
  if (!enabled) return;
  try {
    await fetch(
      `${URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}?EX=${ttlSec}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}` },
      },
    );
  } catch {
    // ignore cache failures
  }
}

export function hash(input: unknown): string {
  // Non-cryptographic 32-bit hash is fine for cache keys
  const s = JSON.stringify(input);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
