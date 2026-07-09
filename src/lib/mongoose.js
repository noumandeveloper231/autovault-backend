import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Registration } from "../models/Registration.js";
import { SuperOwner } from "../models/SuperOwner.js";
import { hashPassword } from "../utils/auth.js";

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
  await SuperOwner.syncIndexes();
  console.log("[db] SuperOwner indexes synced");

  if (env.SUPER_OWNER_PASSWORD) {
    const ownerEmail = String(env.SUPER_OWNER_EMAIL || "").trim().toLowerCase();
    const passwordHash = hashPassword(env.SUPER_OWNER_PASSWORD);
    const ownerResult = await SuperOwner.updateOne(
      { email: ownerEmail },
      {
        $setOnInsert: {
          email: ownerEmail,
          name: "Super Owner",
        },
        $set: {
          passwordHash,
          isActive: true,
        },
      },
      { upsert: true },
    );
    if (ownerResult.upsertedCount > 0) {
      console.log(`[db] Seeded super owner: ${ownerEmail}`);
    }
  } else {
    console.log("[db] SUPER_OWNER_PASSWORD missing. Super owner seed skipped.");
  }
}
