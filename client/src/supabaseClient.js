import { createClient } from '@supabase/supabase-js';

const cleanStr = (s) => (s || "").trim();

// Configuración de Supabase
// Se priorizan las variables de entorno definidas en .env o en el panel de Render (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY)
const supabaseUrl = cleanStr(import.meta.env.VITE_SUPABASE_URL);
const supabaseKey = cleanStr(import.meta.env.VITE_SUPABASE_ANON_KEY);

let supabase = null;

if (supabaseUrl && supabaseKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
    } catch (e) {
        console.error("Error inicializando Supabase Client:", e);
    }
} else {
    console.warn('⚠️ Supabase no configurado. Verifica las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
}

export { supabase };
