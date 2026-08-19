import IORedis from 'ioredis'

export const redisPublisher = new IORedis({
  host: "localhost",
  port: 6379,
});