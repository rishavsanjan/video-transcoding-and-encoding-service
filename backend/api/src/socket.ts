import { Server } from "socket.io";
import { Server as httpServer } from "http";

let io: Server

export function setupSocket(server: httpServer) {
    io = new Server(server, {
        cors: {
            origin: '*'
        }
    });

    io.on("connection", (socket) => {
        console.log("Socket connected:", socket.id);
        socket.on("join-video", (videoId: string) => {
            socket.join(`video:${videoId}`);

            console.log(
                `Socket ${socket.id} joined video:${videoId}`
            );
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