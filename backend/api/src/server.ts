import express from "express";
import videoRoutes from "./routes/video.route"

const app = express();

app.use(express.json())

app.use("/api", videoRoutes);

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`running on port :${PORT}`);
}); 