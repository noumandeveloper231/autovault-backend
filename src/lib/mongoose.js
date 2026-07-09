import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Registration } from "../models/Registration.js";

export async function connectDb() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("[db] MongoDB connected");

  // Remove null stripeSubscriptionId values so sparse unique index allows multiple pending users.
  const cleanup = await Registration.updateMany(
    {
      $or: [
        { stripeSubscriptionId: null },
        { stripeSubscriptionId: "" },
      ],
    },
    { $unset: { stripeSubscriptionId: "" } },
  );
  if (cleanup.modifiedCount > 0) {
    console.log(
      `[db] Cleaned ${cleanup.modifiedCount} registration(s) with null stripeSubscriptionId`,
    );
  }

  await Registration.syncIndexes();
  console.log("[db] Registration indexes synced");
}
