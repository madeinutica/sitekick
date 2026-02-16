-- ─── Enhance jobs table with MarketSharp-sourced data ───────────────────
-- Adds customer contact info, job status tracking, contract/financial data

-- Customer contact info
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_phone text;

-- Job status & dates
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sale_date timestamp with time zone;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS start_date timestamp with time zone;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_date timestamp with time zone;

-- MarketSharp notes (separate from user comments)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ms_notes text;

-- Contract / financial info
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contract_total numeric(12,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contract_balance_due numeric(12,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contract_finance_total numeric(12,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contract_cash_total numeric(12,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contract_status text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contract_date timestamp with time zone;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_type text;

-- Indexes for filtering/sorting
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_sale_date ON jobs(sale_date);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_name ON jobs(customer_name);
