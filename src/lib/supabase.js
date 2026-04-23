import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://muzzjvegynsemlsbwggf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11enpqdmVneW5zZW1sc2J3Z2dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMjI5MDIsImV4cCI6MjA5MTU5ODkwMn0.AO2BgiecEKZvqCeZyJPZrS7AhOI6UsZTMHMvfXyAaXI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'incynq-auth',
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});