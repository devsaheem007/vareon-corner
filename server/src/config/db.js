import mongoose from "mongoose";
import env from "./env.js";

mongoose.set("strictQuery", true);
// Never let a stray `$` operator coming from user input reach a query filter.
mongoose.set("sanitizeFilter", true);

export async function connectDB(uri = env.MONGODB_URI) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 20 });
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
