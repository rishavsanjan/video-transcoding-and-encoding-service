import IORedis from "ioredis"

export const redisSubscriber = new IORedis({
    host: "localhost",
    port: 6379
})