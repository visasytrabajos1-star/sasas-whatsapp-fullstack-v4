-- =============================================
-- MIGRATION: PHASE 3 PRODUCTION READINESS
-- Enhancements for SuperAdmin and Plan Limits
-- =============================================

-- 1. Add tenant tracking to whatsapp_sessions if not exists
ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- 2. Create actual Usage Metrics per tenant (since we didn't have one tracking bot messages accurately)
CREATE TABLE IF NOT EXISTS public.tenant_usage_metrics (
    tenant_id TEXT PRIMARY KEY,
    messages_sent INTEGER DEFAULT 0,
    tokens_consumed INTEGER DEFAULT 0,
    last_reset_date TIMESTAMPTZ DEFAULT NOW(),
    plan_limit INTEGER DEFAULT 500, -- default fallback
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: In app_users or profiles, we don't strictly enforce plan limits per message 
-- since whatsapp_sessions lacked tenant_id. Now we can track using tenant_usage_metrics.
