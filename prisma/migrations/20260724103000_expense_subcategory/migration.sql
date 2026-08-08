-- Add subcategory for the three top-level expense categories
ALTER TABLE "dealership_expenses" ADD COLUMN IF NOT EXISTS "subcategory" VARCHAR(80);

-- category was ExpenseCategory enum in init; schema now uses VARCHAR(50).
-- Convert off the enum BEFORE writing the new string labels (spaces are invalid enum values).
ALTER TABLE "dealership_expenses"
  ALTER COLUMN "category" TYPE VARCHAR(50)
  USING ("category"::text);

DROP TYPE IF EXISTS "ExpenseCategory";

-- Migrate legacy categories → Vehicle / Recurring / Dealership + subcategory
-- Covers: init enum labels (snake_case) and later 14 display labels.
UPDATE "dealership_expenses"
SET
  "subcategory" = CASE "category"
    -- Init enum values
    WHEN 'rent' THEN 'Rent'
    WHEN 'salary_wages' THEN 'Payroll'
    WHEN 'utilities' THEN 'Utilities'
    WHEN 'insurance' THEN 'Insurance'
    WHEN 'software' THEN 'Subscriptions'
    WHEN 'office' THEN 'Office furniture'
    WHEN 'advertising' THEN 'Marketing'
    WHEN 'accounting' THEN 'Other'
    WHEN 'other' THEN 'Other'
    -- Later display labels
    WHEN 'Rent' THEN 'Rent'
    WHEN 'Payroll' THEN 'Payroll'
    WHEN 'Commissions' THEN 'Commissions'
    WHEN 'Utilities' THEN 'Utilities'
    WHEN 'Insurance' THEN 'Insurance'
    WHEN 'Software / subscriptions' THEN 'Subscriptions'
    WHEN 'Flooring fees' THEN 'Flooring fees'
    WHEN 'Auction fees' THEN 'Auction fees'
    WHEN 'Vehicle repairs' THEN 'Repairs'
    WHEN 'Transportation fees' THEN 'Transportation'
    WHEN 'DMV / registration fees' THEN 'DMV / registration'
    WHEN 'Office expenses' THEN 'Office furniture'
    WHEN 'Marketing / advertising' THEN 'Marketing'
    WHEN 'Miscellaneous' THEN 'Other'
    ELSE COALESCE("subcategory", 'Other')
  END,
  "category" = CASE
    WHEN "vehicleVin" IS NOT NULL AND "vehicleVin" <> '' THEN 'Vehicle Expense'
    WHEN "category" IN (
      'rent', 'salary_wages', 'utilities', 'insurance', 'software',
      'Rent', 'Payroll', 'Commissions', 'Utilities', 'Insurance',
      'Software / subscriptions', 'Flooring fees'
    ) THEN 'Recurring Expense'
    WHEN "category" IN (
      'Auction fees', 'Vehicle repairs', 'Transportation fees', 'DMV / registration fees'
    ) THEN 'Vehicle Expense'
    WHEN "category" IN (
      'office', 'advertising', 'accounting', 'other',
      'Office expenses', 'Marketing / advertising', 'Miscellaneous'
    ) THEN 'Dealership Expense'
    WHEN "category" IN (
      'Vehicle Expense', 'Recurring Expense', 'Dealership Expense'
    ) THEN "category"
    ELSE 'Dealership Expense'
  END
WHERE "category" NOT IN ('Vehicle Expense', 'Recurring Expense', 'Dealership Expense')
   OR ("subcategory" IS NULL AND "category" IN ('Vehicle Expense', 'Recurring Expense', 'Dealership Expense'));
