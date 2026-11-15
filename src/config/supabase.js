import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carrega variáveis locais em ambiente dev
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '\x1b[33m%s\x1b[0m',
    '[AVISO SUPABASE] SUPABASE_URL ou SUPABASE_ANON_KEY não estão configuradas no .env. Configure para habilitar autenticação e banco de dados.'
  );
}

// 1. Cliente Anônimo (Operações padrão de Auth e leitura com RLS)
export const supabaseAnon = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// 2. Cliente com Service Role (Operações administrativas: criação de usuários, auditoria imutável, gestão de profiles)
// ATENÇÃO: NUNCA expor esta chave no client-side!
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceRoleKey || supabaseAnonKey || 'placeholder-service-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Cria uma instância de cliente Supabase autenticada no contexto do usuário atual.
 * Permite que queries no banco respeitem rigorosamente o RLS (Row Level Security).
 * 
 * @param {string} accessToken - Token JWT do usuário obtido do cookie httpOnly
 */
export function getAuthenticatedClient(accessToken) {
  return createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

