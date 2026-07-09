import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectDb() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("[db] MongoDB connected");
}
