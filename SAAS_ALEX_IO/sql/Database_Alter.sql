-- ============================================
-- ALEX IO MIGRATION: ADD CONSTITUTION COLUMNS
-- ============================================

-- Add constitution and conversation_structure to bot_configs
ALTER TABLE public.bot_configs 
ADD COLUMN IF NOT EXISTS constitution TEXT,
ADD COLUMN IF NOT EXISTS conversation_structure TEXT;

-- Update default bot name for future records
ALTER TABLE public.bot_configs 
ALTER COLUMN bot_name SET DEFAULT 'ALEX IO';

-- Optional: Initialize existing records with default ALEX IO name if they are still 'Asistente'
UPDATE public.bot_configs 
SET bot_name = 'ALEX IO' 
WHERE bot_name = 'Asistente';
