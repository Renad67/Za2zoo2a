import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/voltride";

const connectDB = async (): Promise<void> => {
  const MAX_RETRIES = 5;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log(` MongoDB connected → ${mongoose.connection.host}`);

      process.on("SIGINT", async () => {
        await mongoose.connection.close();
        console.log("🔌  MongoDB connection closed (SIGINT)");
        process.exit(0);
      });

      return;
    } catch (err) {
      attempt++;
      console.error(
        ` MongoDB connection failed (attempt ${attempt}/${MAX_RETRIES}):`,
        err,
      );

      if (attempt === MAX_RETRIES) {
        console.error("  Could not connect to MongoDB. Exiting.");
        process.exit(1);
      }

      await new Promise((res) => setTimeout(res, 2 ** attempt * 1000));
    }
  }
};

mongoose.connection.on("disconnected", () =>
  console.warn(" MongoDB disconnected"),
);
mongoose.connection.on("reconnected", () => console.log("MongoDB reconnected"));

export default connectDB;
