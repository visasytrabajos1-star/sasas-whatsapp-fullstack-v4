-- Habilitar extensión crypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Añadir columnas de Hashing y Auditoría a la tabla existente `messages`
ALTER TABLE "public"."messages"
ADD COLUMN IF NOT EXISTS "message_hash" text,
ADD COLUMN IF NOT EXISTS "previous_hash" text,
ADD COLUMN IF NOT EXISTS "audit_flag" text,
ADD COLUMN IF NOT EXISTS "audit_reason" text;

-- 2. Función Trigger para calcular el Hash en cadena automáticamente
CREATE OR REPLACE FUNCTION set_message_hash()
RETURNS TRIGGER AS $$
DECLARE
    last_hash text;
BEGIN
    -- Obtener el hash del último mensaje real de la misma conversación
    SELECT message_hash INTO last_hash
    FROM public.messages
    WHERE instance_id = NEW.instance_id AND remote_jid = NEW.remote_jid
    ORDER BY created_at DESC
    LIMIT 1;

    -- Si no hay anterior, usamos una semilla origen
    NEW.previous_hash := COALESCE(last_hash, 'GENESIS_BLOCK');

    -- Calcular el hash SHA-256 inmutable (previous_hash + content + direction)
    NEW.message_hash := encode(digest(NEW.previous_hash || NEW.content || NEW.direction || NEW.created_at::text, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Adjuntar el Trigger a la tabla messages
DROP TRIGGER IF EXISTS trg_set_message_hash ON public.messages;
CREATE TRIGGER trg_set_message_hash
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION set_message_hash();

-- 4. Crear tabla de logs para Shadow Mode de Claude
CREATE TABLE IF NOT EXISTS "public"."shadow_audit_logs" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "tenant_id" uuid,
    "instance_id" text,
    "message_id" uuid REFERENCES "public"."messages"("id") ON DELETE CASCADE,
    "remote_jid" text,
    "ai_response" text,
    "claude_analysis" jsonb,
    "is_compliant" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en la nueva tabla
ALTER TABLE "public"."shadow_audit_logs" ENABLE ROW LEVEL SECURITY;

-- Políticas base para shadow_audit_logs
CREATE POLICY "Allow read for tenant" ON "public"."shadow_audit_logs"
  FOR SELECT USING (tenant_id = auth.uid());
