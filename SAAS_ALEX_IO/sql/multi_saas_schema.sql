-- ============================================
-- MULTI-SAAS DATABASE SCHEMA
-- Supports: ALEX IO + Academia de Idiomas
-- ============================================

-- 1. PRODUCTS TABLE (Defines the SaaS products)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL, -- 'alex-io', 'academia-idiomas'
    name TEXT NOT NULL, -- 'ALEX IO', 'Academia de Idiomas'
    description TEXT,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#3B82F6', -- Blue for ALEX IO
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default products
INSERT INTO public.products (slug, name, description, primary_color) VALUES
('alex-io', 'ALEX IO', 'Asistente de IA para WhatsApp', '#3B82F6'),
('academia-idiomas', 'Academia de Idiomas', 'Plataforma de aprendizaje de idiomas', '#10B981') -- Green
ON CONFLICT (slug) DO NOTHING;

-- 2. PLANS TABLE (Per product)
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- 'Free', 'Pro', 'Enterprise'
    price_monthly NUMERIC(10, 2) DEFAULT 0,
    max_bots INTEGER DEFAULT 1,
    max_messages_monthly INTEGER DEFAULT 100,
    max_students INTEGER DEFAULT 10, -- For academia
    max_courses INTEGER DEFAULT 3, -- For academia
    features JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert plans for ALEX IO
INSERT INTO public.plans (product_id, name, price_monthly, max_bots, max_messages_monthly, features)
SELECT id, 'Free', 0, 1, 100, '["1 Bot", "100 msgs/mes"]' FROM public.products WHERE slug = 'alex-io'
ON CONFLICT DO NOTHING;

INSERT INTO public.plans (product_id, name, price_monthly, max_bots, max_messages_monthly, features)
SELECT id, 'Pro', 29.99, 5, 5000, '["5 Bots", "5000 msgs/mes", "IA Avanzada"]' FROM public.products WHERE slug = 'alex-io'
ON CONFLICT DO NOTHING;

INSERT INTO public.plans (product_id, name, price_monthly, max_bots, max_messages_monthly, features)
SELECT id, 'Enterprise', 99.99, 999999, 999999, '["Bots Ilimitados", "Mensajes Ilimitados", "API"]' FROM public.products WHERE slug = 'alex-io'
ON CONFLICT DO NOTHING;

-- Insert plans for Academia de Idiomas
INSERT INTO public.plans (product_id, name, price_monthly, max_students, max_courses, features)
SELECT id, 'Free', 0, 5, 1, '["5 Estudiantes", "1 Curso"]' FROM public.products WHERE slug = 'academia-idiomas'
ON CONFLICT DO NOTHING;

INSERT INTO public.plans (product_id, name, price_monthly, max_students, max_courses, features)
SELECT id, 'Pro', 19.99, 50, 10, '["50 Estudiantes", "10 Cursos", "Videos"]' FROM public.products WHERE slug = 'academia-idiomas'
ON CONFLICT DO NOTHING;

INSERT INTO public.plans (product_id, name, price_monthly, max_students, max_courses, features)
SELECT id, 'Enterprise', 49.99, 999999, 999999, '["Estudiantes Ilimitados", "Cursos Ilimitados", "Certificados"]' FROM public.products WHERE slug = 'academia-idiomas'
ON CONFLICT DO NOTHING;

-- 3. USER PRODUCTS (Links users to products - one user can have both!)
CREATE TABLE IF NOT EXISTS public.user_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.plans(id),
    status TEXT DEFAULT 'active', -- 'active', 'cancelled', 'past_due'
    subscription_start DATE DEFAULT CURRENT_DATE,
    subscription_end DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- 4. PROFILES (Extends Auth.Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. USAGE METRICS (Per product)
CREATE TABLE IF NOT EXISTS public.usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL, -- '2026-02'
    messages_sent INTEGER DEFAULT 0,
    tokens_consumed INTEGER DEFAULT 0,
    students_count INTEGER DEFAULT 0,
    courses_count INTEGER DEFAULT 0,
    UNIQUE(user_id, product_id, month_year)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

-- Products: Public read
CREATE POLICY "Products are viewable by everyone" ON public.products
    FOR SELECT USING (true);

-- Plans: Public read
CREATE POLICY "Plans are viewable by everyone" ON public.plans
    FOR SELECT USING (true);

-- User Products: Users see only their own
CREATE POLICY "Users see own product subscriptions" ON public.user_products
    FOR ALL USING (auth.uid() = user_id);

-- Profiles: Users manage own profile
CREATE POLICY "Users manage own profile" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- Usage: Users see own usage
CREATE POLICY "Users see own usage" ON public.usage_metrics
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- ACADEMIA SPECIFIC TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id), -- Will filter by 'academia-idiomas'
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    language TEXT NOT NULL, -- 'english', 'spanish', 'french', etc.
    level TEXT DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    native_language TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    progress INTEGER DEFAULT 0,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, course_id)
);

-- RLS for Academia tables
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own courses" ON public.courses
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own students" ON public.students
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own enrollments" ON public.enrollments
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM public.students WHERE id = student_id
            UNION
            SELECT user_id FROM public.courses WHERE id = course_id
        )
    );

-- ============================================
-- ALEX IO SPECIFIC TABLES (Update existing)
-- ============================================

-- Add product_id to existing tables
ALTER TABLE public.bot_configs ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

-- Update RLS to filter by product
DROP POLICY IF EXISTS "Users can manage own bots" ON public.bot_configs;
CREATE POLICY "Users manage own bots" ON public.bot_configs
    FOR ALL USING (
        auth.uid() = user_id 
        AND product_id = (SELECT id FROM public.products WHERE slug = 'alex-io')
    );

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
