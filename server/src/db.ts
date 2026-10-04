import mongoose from 'mongoose';

export async function connectDb(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  return mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
