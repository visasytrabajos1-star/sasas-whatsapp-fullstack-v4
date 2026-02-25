-- Tabla de usuarios de la app (auth propia con bcrypt)
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'PRO',
    role TEXT NOT NULL DEFAULT 'OWNER',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para búsquedas rápidas por email
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email);

-- Row Level Security
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Solo el service role puede leer/escribir (el backend usa service role key)
CREATE POLICY "Service role full access" ON app_users
    USING (auth.role() = 'service_role');
