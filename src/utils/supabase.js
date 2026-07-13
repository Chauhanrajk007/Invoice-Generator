/**
 * supabase.js — Supabase Client Initialization
 * 
 * Uses ESM CDN import so no npm install needed.
 * Reads config from Vite environment variables (set in Vercel dashboard).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

export function isSupabaseConfigured() {
  return supabase !== null;
}

export { supabase };
