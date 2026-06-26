import "dotenv/config";
import http from "http";
import app from "./app";
import connectDB from "./config/database";
import { setupWebSocket } from "./websocket/wsServer";
import { env } from "./config/env";

async function bootstrap() {
  await connectDB();

  const server = http.createServer(app);

  setupWebSocket(server);

  server.listen(env.PORT, () => {
    console.log(`\n  ⚡  VoltRide backend v2.0 running on http://localhost:${env.PORT}`);
    console.log(`  🔌  WebSocket endpoint  →  ws://localhost:${env.PORT}/ws`);
    console.log(`  📡  API base            →  http://localhost:${env.PORT}/api`);
    console.log(`  💚  Health check        →  http://localhost:${env.PORT}/health`);
    console.log(`  📂  Uploads served at   →  http://localhost:${env.PORT}/uploads`);
    console.log();
  });
}

bootstrap().catch((err) => {
  console.error("💀  Failed to start server:", err);
  process.exit(1);
});
