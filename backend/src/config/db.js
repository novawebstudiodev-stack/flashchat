import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Sync indexes once on startup (creates TTL index if missing)
    await mongoose.connection.syncIndexes();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
};
