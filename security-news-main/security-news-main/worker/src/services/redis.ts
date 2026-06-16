import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let client: ReturnType<typeof createClient> | null = null;

export async function getRedisClient(): Promise<ReturnType<typeof createClient>> {
  if (!client) {
    client = createClient({ url: REDIS_URL });
    client.on("error", (err) => console.error("Redis error:", err));
    await client.connect();
  }
  return client;
}

export async function getCached<T>(key: string): Promise<T | null> {
  const redis = await getRedisClient();
  const value = await redis.get(key);
  if (!value) return null;
  return JSON.parse(value) as T;
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds = 7200
): Promise<void> {
  const redis = await getRedisClient();
  await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
