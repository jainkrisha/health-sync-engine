import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server-core';
import { createApp } from '../src/app';
import { createSocketServer } from '../src/socket';
import { setIo } from '../src/services/events';

/**
 * Starts the app against a throwaway database. Set MONGO_URI_TEST to use an
 * existing MongoDB; otherwise an in-memory MongoDB is downloaded and started.
 */
export async function startTestServer() {
  let memory: MongoMemoryServer | null = null;
  let uri = process.env.MONGO_URI_TEST;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server-core');
    memory = await MongoMemoryServer.create();
    uri = memory.getUri();
  }
  const dbName = `healthsync_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  await mongoose.connect(uri, { dbName });

  const app = createApp();
  const httpServer: HttpServer = createServer(app);
  const io = createSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;

  return {
    app,
    url: `http://127.0.0.1:${port}`,
    async stop() {
      io.close();
      setIo(null);
      await new Promise((resolve) => httpServer.close(resolve));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      await memory?.stop();
    },
  };
}
