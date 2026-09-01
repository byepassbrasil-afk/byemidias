-- Partner Contracts Module
-- Tables: contract_templates (modelos) + partner_contracts (contratos assinados)

CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration_months INT,
  monthly_fee NUMERIC(12,2) DEFAULT 0,
  hourly_fee NUMERIC(12,2) DEFAULT 0,
  bonus_structure JSONB,
  custom_clauses TEXT,
  status TEXT DEFAULT 'active',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contract_templates_org ON contract_templates(organization_id);

CREATE TABLE IF NOT EXISTS partner_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partner_access(id) ON DELETE CASCADE,
  template_id UUID REFERENCES contract_templates(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  duration_months INT NOT NULL,
  monthly_fee NUMERIC(12,2) DEFAULT 0,
  hourly_fee NUMERIC(12,2) DEFAULT 0,
  bonus_structure JSONB,
  custom_clauses TEXT,
  contract_pdf_url TEXT,
  contract_url_token TEXT,
  signing_method TEXT,
  signed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_partner_contracts_partner ON partner_contracts(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_contracts_org ON partner_contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_partner_contracts_end ON partner_contracts(end_date) WHERE end_date IS NOT NULL AND status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_contracts_token ON partner_contracts(contract_url_token) WHERE contract_url_token IS NOT NULL;
