-- =============================================
-- MIGRATION: FIX SCHEMA MISMATCHES
-- Fixes "column does not exist" and "table not found" errors
-- =============================================

-- 1. FIX whatsapp_sessions TABLE
-- Adding missing columns expected by the application code
ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS instance_id TEXT;
ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'disconnected';
ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- Ensure instance_id is UNIQUE to allow UPSERT operations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_sessions_instance_id_key'
    ) THEN
        ALTER TABLE public.whatsapp_sessions ADD CONSTRAINT whatsapp_sessions_instance_id_key UNIQUE (instance_id);
    END IF;
END $$;

-- 2. CREATE prompt_versiones TABLE
-- Required for Super Prompt versioning and history
CREATE TABLE IF NOT EXISTS public.prompt_versiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL DEFAULT 'test', -- 'test', 'active', 'archived'
  prompt_text TEXT NOT NULL,
  super_prompt_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompt_versiones_tenant_instance_created
  ON public.prompt_versiones (tenant_id, instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_versiones_status
  ON public.prompt_versiones (status);

-- 3. FIX tenant_usage_metrics
-- Ensure tracking table exists
CREATE TABLE IF NOT EXISTS public.tenant_usage_metrics (
    tenant_id TEXT PRIMARY KEY,
    messages_sent INTEGER DEFAULT 0,
    tokens_consumed INTEGER DEFAULT 0,
    last_reset_date TIMESTAMPTZ DEFAULT NOW(),
    plan_limit INTEGER DEFAULT 500,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RPC for atomic increments (if needed by the code)
CREATE OR REPLACE FUNCTION increment_tenant_usage(t_id TEXT, msg_incr INTEGER, tk_incr INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.tenant_usage_metrics (tenant_id, messages_sent, tokens_consumed, updated_at)
    VALUES (t_id, msg_incr, tk_incr, NOW())
    ON CONFLICT (tenant_id) DO UPDATE SET
        messages_sent = public.tenant_usage_metrics.messages_sent + msg_incr,
        tokens_consumed = public.tenant_usage_metrics.tokens_consumed + tk_incr,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
