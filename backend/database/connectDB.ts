import mongoose, { ConnectOptions } from "mongoose";

let isConnected = false;

const MONGO_OPTIONS: ConnectOptions = {
  maxPoolSize: 50,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 10000,
  family: 4,
  retryWrites: true,
  w: "majority",
};

// Attach global listeners only once
mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB connected successfully");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected, retrying...");
});

process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("🛑 MongoDB connection closed due to app termination");
  process.exit(0);
});

export const connectDB = async (): Promise<void> => {
  if (isConnected) return;

  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL environment variable is not defined");
  }

  try {
    await mongoose.connect(mongoUrl, MONGO_OPTIONS);
    isConnected = true;
  } catch (error: any) {
    console.error("MongoDB connection failed:", error.message);
  }
};
