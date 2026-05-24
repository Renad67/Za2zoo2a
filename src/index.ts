import "dotenv/config";
import http from "http";
import app from "./app";
import connectDB from "./config/database";
import { setupWebSocket } from "./websocket/wsServer";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

async function bootstrap() {
  await connectDB();

  const server = http.createServer(app);

  setupWebSocket(server);

  server.listen(PORT, () => {
    console.log(`  VoltRide backend running on http://localhost:${PORT}`);
    console.log(`  WebSocket endpoint  →  ws://localhost:${PORT}/ws`);
    console.log(`  API base            →  http://localhost:${PORT}/api`);
    console.log(`   Health check        →  http://localhost:${PORT}/health`);
  });
}

bootstrap().catch((err) => {
  console.error("💀  Failed to start server:", err);
  process.exit(1);
});
