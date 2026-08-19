import { io } from "socket.io-client";

const socket = io("http://localhost:5000");
console.log("running")
socket.on("connect", () => {
  console.log("Connected:", socket.id);

  socket.emit("join-video", "test-video");
});

socket.on("encoding-progress", (data) => {
  console.log("Progress:", data);
});