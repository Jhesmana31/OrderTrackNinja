import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_PROJECT_ID.supabase.co';
const supabaseKey = 'YOUR_ANON_OR_SERVICE_ROLE_KEY';

export const supabase = createClient(supabaseUrl, supabaseKey);
