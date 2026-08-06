-- Align default monthly fee with post-trial plan pricing ($99.99 base).
ALTER TABLE "Registration" ALTER COLUMN "monthlyFee" SET DEFAULT 99.99;
ALTER TABLE "Dealership" ALTER COLUMN "monthlyFee" SET DEFAULT 99.99;
