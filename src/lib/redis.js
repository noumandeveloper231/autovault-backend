import { Redis } from "@upstash/redis";
import { env } from "../config/env.js";
import { logger } from "../common/logger.js";

let redis = null;

export function getRedis() {
  if (redis) return redis;
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    logger.warn(
      "[redis] UPSTASH_REDIS_REST_URL/TOKEN missing — Redis features disabled",
    );
    return null;
  }
  redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return redis;
}

/** Simple job enqueue using Upstash Redis list. */
export async function enqueueJob(queueName, payload) {
  const client = getRedis();
  if (!client) return false;
  await client.lpush(
    `queue:${queueName}`,
    JSON.stringify({ ...payload, enqueuedAt: new Date().toISOString() }),
  );
  return true;
}

export async function dequeueJob(queueName) {
  const client = getRedis();
  if (!client) return null;
  const raw = await client.rpop(`queue:${queueName}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}
