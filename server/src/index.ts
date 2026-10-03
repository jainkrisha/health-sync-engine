import { createServer } from 'node:http';
import { createApp } from './app';
import { createSocketServer } from './socket';
import { connectDb } from './db';
import { config } from './config';

async function main() {
  await connectDb(config.mongoUri);
  const app = createApp();
  const httpServer = createServer(app);
  createSocketServer(httpServer);
  httpServer.listen(config.port, () => {
    console.log(`HealthSync server listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
