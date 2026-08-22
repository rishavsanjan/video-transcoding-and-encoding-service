import express from "express";
import videoRoutes from "./routes/video.route"
import { createServer } from "http";
import { setupSocket } from "./socket";
import cors from "cors"
const app = express();
app.use(cors())
app.use(express.json())

app.use("/api", videoRoutes);


const PORT = 5000;

const server = createServer(app);
setupSocket(server)


server.listen(PORT, () => {
  console.log(`running on port :${PORT}`);
}); 