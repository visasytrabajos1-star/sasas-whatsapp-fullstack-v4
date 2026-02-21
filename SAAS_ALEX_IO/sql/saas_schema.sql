-- ============================================
-- ALEX IO SaaS CORE SCHEMA
-- ============================================

-- 1. PLANS TABLE
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- 'Free', 'Pro', 'Enterprise'
    price_monthly NUMERIC(10, 2) DEFAULT 0,
    max_bots INTEGER DEFAULT 1,
    max_messages_monthly INTEGER DEFAULT 100,
    features JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Plans
INSERT INTO public.plans (name, price_monthly, max_bots, max_messages_monthly, features)
VALUES 
('Free', 0, 1, 100, '["Soporte Básico", "1 Bot ALEX IO", "100 msgs/mes"]'),
('Pro', 29.99, 5, 5000, '["Soporte Prioritario", "5 Bots ALEX IO", "5000 msgs/mes", "Voz Clonada Premium"]'),
('Enterprise', 99.99, 20, 50000, '["Soporte 24/7", "Bots Ilimitados", "API Access", "White Label"]')
ON CONFLICT DO NOTHING;

-- 2. PROFILES (Extends Auth.Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    plan_id UUID REFERENCES public.plans(id),
    subscription_status TEXT DEFAULT 'active', -- 'active', 'trailing', 'past_due', 'canceled'
    is_admin BOOLEAN DEFAULT FALSE, -- For SuperAdminDashboard access
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. USAGE METRICS (Real-time tracking)
CREATE TABLE IF NOT EXISTS public.usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL, -- e.g., '2026-02'
    messages_sent INTEGER DEFAULT 0,
    tokens_consumed INTEGER DEFAULT 0,
    UNIQUE(user_id, month_year)
);

-- 4. ROW LEVEL SECURITY (Multi-tenant isolation)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Policy: Users can only see their own usage
CREATE POLICY "Users can view own usage" 
ON public.usage_metrics FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Admin Dashboard access (Isolation by user_id)
-- First, add user_id to bot_configs if it doesn't exist
ALTER TABLE public.bot_configs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE POLICY "Users can manage own bots" 
ON public.bot_configs FOR ALL 
USING (auth.uid() = user_id);

-- 5. FUNCTION: Sync Profile on Auth Sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, plan_id)
  VALUES (NEW.id, NEW.email, (SELECT id FROM public.plans WHERE name = 'Free' LIMIT 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
