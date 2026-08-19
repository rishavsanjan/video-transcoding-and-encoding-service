import { Server } from "socket.io";
import { Server as httpServer } from "http";
import { redisSubscriber } from "./redisSubscriber";

let io: Server

export function setupSocket(server: httpServer) {
    io = new Server(server, {
        cors: {
            origin: '*'
        }
    });

    io.on("connection", (socket) => {
        console.log("Socket connected:", socket.id);
        // socket.on("join-video", (videoId: string) => {
        //     socket.join(`video:${videoId}`);

        //     console.log(
        //         `Socket ${socket.id} joined video:${videoId}`
        //     );
        // });

        socket.on("join-video", (videoId: string) => {
            socket.join(`video:${videoId}`);

            console.log(
                `Socket ${socket.id} joined video:${videoId}`
            );

            socket.emit("encoding-progress", {
                videoId,
                resolution: 720,
                progress: 50,
            });
        });

        socket.on("disconnect", () => {
            console.log("Socket disconnected:", socket.id);
        });
    })

    return io;
}

export function getIO() {
    if (!io) {
        throw new Error("Socket.IO has not been initialized");
    }

    return io;
}

async function startRedisSubscriber() {
    await redisSubscriber.psubscribe(
        "video:*:progress"
    );

    redisSubscriber.on(
        "pmessage",
        (_pattern, channel, message) => {
            const data = JSON.parse(message);

            const parts = channel.split(":");

            const videoId = parts[1];

            io.to(`video:${videoId}`).emit(
                "encoding-progress",
                data
            );
        }
    );

    console.log(
        "Redis progress subscriber started"
    );

}