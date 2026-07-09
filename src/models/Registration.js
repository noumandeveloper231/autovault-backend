import mongoose from "mongoose";
import { PAYMENT_STATUSES, REGISTRATION_STATUSES } from "../utils/plans.js";

const registrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "", trim: true },
    dealership: { type: String, required: true, trim: true },
    plan: {
      type: String,
      enum: ["wholesaler", "independent_dealer", "growing_dealership"],
      default: null,
    },
    status: {
      type: String,
      enum: REGISTRATION_STATUSES,
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
    },
    monthlyFee: { type: Number, default: 39.99 },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    stripeCheckoutSessionId: { type: String },
    completionTokenHash: { type: String, default: null },
    completionTokenExpiresAt: { type: Date, default: null },
    emailSentAt: { type: Date, default: null },
    temporaryPasswordHash: { type: String, default: null },
    temporaryPasswordSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

registrationSchema.index({ email: 1 }, { unique: true });
registrationSchema.index({ stripeCustomerId: 1 });
registrationSchema.index({ stripeCheckoutSessionId: 1 });
registrationSchema.index(
  { stripeSubscriptionId: 1 },
  { unique: true, sparse: true },
);

registrationSchema.pre("save", function unsetNullStripeIds(next) {
  if (this.stripeSubscriptionId == null || this.stripeSubscriptionId === "") {
    this.stripeSubscriptionId = undefined;
  }
  if (this.stripeCustomerId == null || this.stripeCustomerId === "") {
    this.stripeCustomerId = undefined;
  }
  if (this.stripeCheckoutSessionId == null || this.stripeCheckoutSessionId === "") {
    this.stripeCheckoutSessionId = undefined;
  }
  next();
});

export const Registration = mongoose.model("Registration", registrationSchema);
