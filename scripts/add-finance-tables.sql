-- Financial tables: expenses and revenues per organization

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recurring BOOLEAN DEFAULT FALSE,
  recurrence_period TEXT,  -- 'monthly' | 'yearly' | null
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id, date DESC);

CREATE TABLE IF NOT EXISTS revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,  -- 'invoice' | 'partner' | 'campaign' | 'manual'
  source_id UUID,  -- FK to partner_invoices, partner_payments, campaigns, etc.
  category TEXT,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  partner_id UUID REFERENCES partner_access(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revenues_org ON revenues(organization_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_revenues_source ON revenues(source, source_id);
