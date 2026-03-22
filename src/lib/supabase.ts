import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vfiwmwwuvnefvygchegw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmaXdtd3d1dm5lZnZ5Z2NoZWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODgwMTIsImV4cCI6MjA4OTc2NDAxMn0.UKzqF_gMsFjeZWh_-PTIIntd5eANcBpzJxPF3dVYpGA'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY
)
