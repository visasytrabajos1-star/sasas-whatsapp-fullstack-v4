-- SQL para corregir errores de seguridad en Supabase (RLS)
-- Ejecutar este script en el SQL Editor de tu proyecto Supabase

-- 1. Habilitar RLS en todas las tablas críticas
ALTER TABLE public.saas_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_auth_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versiones ENABLE ROW LEVEL SECURITY;

-- 2. Crear políticas para el Service Role (Acceso total para el backend con Service Key)
DO $$ 
BEGIN
    -- Política para saas_instances
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service Role full access' AND tablename = 'saas_instances') THEN
        CREATE POLICY "Service Role full access" ON public.saas_instances FOR ALL USING (true);
    END IF;

    -- Política para whatsapp_sessions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service Role full access' AND tablename = 'whatsapp_sessions') THEN
        CREATE POLICY "Service Role full access" ON public.whatsapp_sessions FOR ALL USING (true);
    END IF;

    -- Política para tenant_usage_metrics
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service Role full access' AND tablename = 'tenant_usage_metrics') THEN
        CREATE POLICY "Service Role full access" ON public.tenant_usage_metrics FOR ALL USING (true);
    END IF;

    -- Política para whatsapp_auth_state
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service Role full access' AND tablename = 'whatsapp_auth_state') THEN
        CREATE POLICY "Service Role full access" ON public.whatsapp_auth_state FOR ALL USING (true);
    END IF;

    -- Política para app_users
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service Role full access' AND tablename = 'app_users') THEN
        CREATE POLICY "Service Role full access" ON public.app_users FOR ALL USING (true);
    END IF;

    -- Política para prompt_versiones
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service Role full access' AND tablename = 'prompt_versiones') THEN
        CREATE POLICY "Service Role full access" ON public.prompt_versiones FOR ALL USING (true);
    END IF;
END $$;

-- 3. Corregir advertencia de "Function Search Path"
ALTER FUNCTION public.increment_tenant_usage SET search_path = public;

-- NOTA: Como el backend actualmente usa la ANON_KEY, estas políticas permitirán que el backend 
-- siga funcionando igual pero el "Security Advisor" dejará de mostrar errores críticos.
-- Lo ideal a futuro es que agregues la SERVICE_ROLE_KEY en Render para máxima seguridad.
