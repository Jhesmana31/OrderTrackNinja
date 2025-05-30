import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl) throw new Error('SUPABASE_URL environment variable is required.');
if (!supabaseKey) throw new Error('SUPABASE_KEY environment variable is required.');

export const supabase = createClient(supabaseUrl, supabaseKey);
