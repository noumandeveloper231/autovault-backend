export const PLAN_LABEL_TO_SLUG = {
  Wholesaler: "wholesaler",
  "Independent Dealer": "independent_dealer",
  "Growing Dealership": "growing_dealership",
};

export const PLAN_SLUG_TO_LABEL = {
  wholesaler: "Wholesaler",
  independent_dealer: "Independent Dealer",
  growing_dealership: "Growing Dealership",
};

export const PLAN_TO_PRICE_ENV = {
  wholesaler: "STRIPE_WHOLESALER_PRICE_ID",
  independent_dealer: "STRIPE_INDEPENDENT_DEALER_PRICE_ID",
  growing_dealership: "STRIPE_GROWING_DEALERSHIP_PRICE_ID",
};

export const REGISTRATION_STATUSES = [
  "pending",
  "checkout_started",
  "active",
  "payment_failed",
  "canceled",
];

export const PAYMENT_STATUSES = ["pending", "on-time", "behind"];
