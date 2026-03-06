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

-- 4. CREATE whatsapp_auth_state TABLE
-- Stores Baileys credentials and keys to survive ephemeral Render restarts
CREATE TABLE IF NOT EXISTS public.whatsapp_auth_state (
    instance_id TEXT NOT NULL,
    key_name TEXT NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (instance_id, key_name)
);

-- Optimize index for querying a specific session
CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_state_instance ON public.whatsapp_auth_state (instance_id);

-- 5. CREATE messages TABLE FOR AUDIT & ANALYTICS
-- Stores incoming/outgoing chat history
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id TEXT NOT NULL,
    tenant_id TEXT,
    remote_jid TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    message_type TEXT NOT NULL DEFAULT 'text',
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_instance_jid ON public.messages (instance_id, remote_jid);
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON public.messages (tenant_id);

-- ENABLE RLS (Row Level Security) ON MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view only their tenant logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can view their own tenant messages'
    ) THEN
        CREATE POLICY "Users can view their own tenant messages" ON public.messages
            FOR SELECT USING (tenant_id = auth.uid()::text OR auth.uid() IN (SELECT id FROM public.app_users WHERE tenant_id = messages.tenant_id));
    END IF;
END $$;
