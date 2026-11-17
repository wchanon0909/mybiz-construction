PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS companies (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, legal_name TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
 tax_id TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
 vat_registered INTEGER NOT NULL DEFAULT 0, bank_name TEXT NOT NULL DEFAULT '', bank_account TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO companies(id,name) VALUES ('main','MyBiz Construction');
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, google_sub TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL, picture TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS memberships (
 company_id TEXT NOT NULL REFERENCES companies(id), user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('admin','user')), active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(company_id,user_id)
);
CREATE TABLE IF NOT EXISTS invitations (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
 email TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','user')),
 created_by TEXT REFERENCES users(id), accepted_at TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(company_id,email)
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS contacts (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
 type TEXT NOT NULL CHECK(type IN ('customer','supplier','subcontractor','other')),
 name TEXT NOT NULL, contact_person TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
 email TEXT NOT NULL DEFAULT '', tax_id TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
 payment_terms_days INTEGER NOT NULL DEFAULT 30, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id,type,name);
CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), code TEXT NOT NULL,
 name TEXT NOT NULL, customer_id TEXT REFERENCES contacts(id), manager_user_id TEXT REFERENCES users(id),
 location TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','on_hold','completed','cancelled')),
 progress_percent REAL NOT NULL DEFAULT 0 CHECK(progress_percent BETWEEN 0 AND 100),
 start_date TEXT, end_date TEXT, contract_number TEXT NOT NULL DEFAULT '',
 contract_value_cents INTEGER NOT NULL DEFAULT 0 CHECK(contract_value_cents>=0),
 vat_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK(vat_rate_bps BETWEEN 0 AND 10000),
 wht_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK(wht_rate_bps BETWEEN 0 AND 10000),
 retention_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK(retention_rate_bps BETWEEN 0 AND 10000),
 advance_received_cents INTEGER NOT NULL DEFAULT 0 CHECK(advance_received_cents>=0),
 payment_terms_days INTEGER NOT NULL DEFAULT 30,
 created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(company_id,code)
);
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id,status);
CREATE TABLE IF NOT EXISTS project_members (
 project_id TEXT NOT NULL REFERENCES projects(id), user_id TEXT NOT NULL REFERENCES users(id),
 PRIMARY KEY(project_id,user_id)
);
CREATE TABLE IF NOT EXISTS contract_variations (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
 title TEXT NOT NULL, amount_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 note TEXT NOT NULL DEFAULT '', created_by TEXT REFERENCES users(id), approved_by TEXT REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT (datetime('now')), approved_at TEXT
);
CREATE TABLE IF NOT EXISTS milestones (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
 title TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
 due_date TEXT, status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','ready','billed','completed')),
 sort_order INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id,sort_order);
CREATE TABLE IF NOT EXISTS boq_items (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), code TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL, description TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'งาน',
 quantity_milli INTEGER NOT NULL DEFAULT 1000 CHECK(quantity_milli>=0),
 unit_rate_cents INTEGER NOT NULL DEFAULT 0 CHECK(unit_rate_cents>=0),
 budget_cents INTEGER NOT NULL DEFAULT 0 CHECK(budget_cents>=0),
 revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_boq_project ON boq_items(project_id,category);
CREATE TABLE IF NOT EXISTS boq_revisions (
 id TEXT PRIMARY KEY, boq_item_id TEXT NOT NULL REFERENCES boq_items(id),
 old_budget_cents INTEGER NOT NULL, new_budget_cents INTEGER NOT NULL, reason TEXT NOT NULL,
 changed_by TEXT NOT NULL REFERENCES users(id), changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS expenses (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
 project_id TEXT NOT NULL REFERENCES projects(id), vendor_id TEXT REFERENCES contacts(id),
 expense_date TEXT NOT NULL, description TEXT NOT NULL,
 subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_cents>=0),
 vat_cents INTEGER NOT NULL DEFAULT 0 CHECK(vat_cents>=0),
 wht_cents INTEGER NOT NULL DEFAULT 0 CHECK(wht_cents>=0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','approved','rejected')),
 rejection_reason TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL REFERENCES users(id),
 approved_by TEXT REFERENCES users(id), approved_at TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id,status,expense_date);
CREATE TABLE IF NOT EXISTS expense_items (
 id TEXT PRIMARY KEY, expense_id TEXT NOT NULL REFERENCES expenses(id),
 boq_item_id TEXT REFERENCES boq_items(id), category TEXT NOT NULL,
 description TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>=0)
);
CREATE INDEX IF NOT EXISTS idx_expense_items_boq ON expense_items(boq_item_id);
CREATE TABLE IF NOT EXISTS documents (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
 project_id TEXT REFERENCES projects(id), contact_id TEXT REFERENCES contacts(id),
 milestone_id TEXT REFERENCES milestones(id), type TEXT NOT NULL CHECK(type IN ('quotation','billing','invoice','receipt')),
 number TEXT, title TEXT NOT NULL, doc_date TEXT NOT NULL, due_date TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','void')),
 subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_cents>=0),
 vat_rate_bps INTEGER NOT NULL DEFAULT 0, vat_cents INTEGER NOT NULL DEFAULT 0,
 wht_rate_bps INTEGER NOT NULL DEFAULT 0, wht_cents INTEGER NOT NULL DEFAULT 0,
 retention_cents INTEGER NOT NULL DEFAULT 0, advance_deduct_cents INTEGER NOT NULL DEFAULT 0,
 total_cents INTEGER NOT NULL DEFAULT 0, net_due_cents INTEGER NOT NULL DEFAULT 0,
 note TEXT NOT NULL DEFAULT '', source_document_id TEXT REFERENCES documents(id),
 source_payment_id TEXT UNIQUE, snapshot_json TEXT,
 issued_at TEXT, issued_by TEXT REFERENCES users(id), pdf_storage_key TEXT,
 created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(company_id,number)
);
CREATE INDEX IF NOT EXISTS idx_docs_company ON documents(company_id,type,status,doc_date);
CREATE INDEX IF NOT EXISTS idx_docs_project ON documents(project_id,type);
CREATE TABLE IF NOT EXISTS document_items (
 id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
 description TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'งาน', quantity_milli INTEGER NOT NULL DEFAULT 1000,
 unit_rate_cents INTEGER NOT NULL DEFAULT 0, amount_cents INTEGER NOT NULL DEFAULT 0,
 sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS document_sequences (
 company_id TEXT NOT NULL REFERENCES companies(id), type TEXT NOT NULL, year INTEGER NOT NULL,
 current_seq INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(company_id,type,year)
);
CREATE TABLE IF NOT EXISTS payments (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
 project_id TEXT NOT NULL REFERENCES projects(id), direction TEXT NOT NULL CHECK(direction IN ('in','out')),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0), payment_date TEXT NOT NULL,
 method TEXT NOT NULL DEFAULT 'bank', reference TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id,payment_date);
CREATE TABLE IF NOT EXISTS payment_allocations (
 id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES payments(id),
 target_type TEXT NOT NULL CHECK(target_type IN ('invoice','expense')),
 target_id TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 UNIQUE(payment_id,target_type,target_id)
);
CREATE INDEX IF NOT EXISTS idx_allocations_target ON payment_allocations(target_type,target_id);
CREATE TRIGGER IF NOT EXISTS validate_payment_allocation BEFORE INSERT ON payment_allocations BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM payments p WHERE p.id=NEW.payment_id AND p.amount_cents=NEW.amount_cents) THEN RAISE(ABORT,'Payment amount mismatch') END;
 SELECT CASE WHEN NEW.target_type='invoice' AND NOT EXISTS(
  SELECT 1 FROM documents d JOIN payments p ON p.id=NEW.payment_id WHERE d.id=NEW.target_id AND d.project_id=p.project_id AND d.type='invoice' AND d.status='issued' AND p.direction='in'
 ) THEN RAISE(ABORT,'Invalid invoice allocation') END;
 SELECT CASE WHEN NEW.target_type='expense' AND NOT EXISTS(
  SELECT 1 FROM expenses e JOIN payments p ON p.id=NEW.payment_id WHERE e.id=NEW.target_id AND e.project_id=p.project_id AND e.status='approved' AND p.direction='out'
 ) THEN RAISE(ABORT,'Invalid expense allocation') END;
 SELECT CASE WHEN NEW.target_type='invoice' AND NEW.amount_cents + COALESCE((SELECT SUM(a.amount_cents) FROM payment_allocations a WHERE a.target_type='invoice' AND a.target_id=NEW.target_id),0) > COALESCE((SELECT d.net_due_cents FROM documents d WHERE d.id=NEW.target_id),0) THEN RAISE(ABORT,'Invoice overpayment') END;
 SELECT CASE WHEN NEW.target_type='expense' AND NEW.amount_cents + COALESCE((SELECT SUM(a.amount_cents) FROM payment_allocations a WHERE a.target_type='expense' AND a.target_id=NEW.target_id),0) > COALESCE((SELECT e.subtotal_cents+e.vat_cents-e.wht_cents FROM expenses e WHERE e.id=NEW.target_id),0) THEN RAISE(ABORT,'Expense overpayment') END;
END;
CREATE TABLE IF NOT EXISTS storage_connections (
 company_id TEXT NOT NULL REFERENCES companies(id), provider TEXT NOT NULL CHECK(provider IN ('google_drive')),
 account_email TEXT, refresh_token_enc TEXT, root_folder_id TEXT,
 connected_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(company_id,provider)
);
CREATE TABLE IF NOT EXISTS storage_folders (
 project_id TEXT PRIMARY KEY REFERENCES projects(id), drive_folder_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attachments (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), project_id TEXT REFERENCES projects(id),
 owner_type TEXT NOT NULL DEFAULT 'project', owner_id TEXT,
 category TEXT NOT NULL, provider TEXT NOT NULL CHECK(provider IN ('r2','google_drive')),
 storage_key TEXT NOT NULL, file_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL,
 uploaded_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attachments_project ON attachments(project_id,category);
CREATE TABLE IF NOT EXISTS audit_logs (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
 user_id TEXT REFERENCES users(id), action TEXT NOT NULL, entity_type TEXT NOT NULL,
 entity_id TEXT, details_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id,created_at DESC);
