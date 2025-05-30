import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qnzbjkvgmubxgjndtrhm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuemJqa3ZnbXVieGdqbmR0cmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NjEzNTMsImV4cCI6MjA2NDEzNzM1M30.-3SyNKrbtwOQZQRhEfZSE5k6jDbs77R6m1cnpFuzTIg'
);

export { supabase };
