import { createClient } from '@supabase/supabase-js';

// Em produção, defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example).
// Sem essas variáveis, o sistema roda em MODO DEMONSTRAÇÃO com dados em memória/localStorage,
// permitindo navegar e testar todas as telas sem um projeto Supabase configurado.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string)
  : null;
