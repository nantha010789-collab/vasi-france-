// Browser-safe Supabase configuration. The service-role key must never be placed here.
window.VASI_ADMIN_CONFIG = {
  supabaseUrl: window.VASI_SUPABASE_URL || '',
  supabasePublishableKey: window.VASI_SUPABASE_ANON_KEY || ''
};
