import { createClient } from '@supabase/supabase-js';

// Fallback to project credentials if environment variables are not injected by Netlify
const DEFAULT_SUPABASE_URL = 'https://pmtaeyiwarcbcolewwna.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_nzoUPKbs4OB5yAlsaZzwAA_FNMNdEcN';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
