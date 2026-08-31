/* VASI checkout helper. Final totals must always be confirmed by the server. */
window.VASI_CHECKOUT = (() => {
  const SUPABASE_URL = 'https://vhfyvkrvysrooaqzcxsp.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT';
  let client;
  function init() {
    if (!client && window.supabase) client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return client;
  }
  async function calculate(subtotal, promoCode = '') {
    const db = init();
    if (!db) throw new Error('Supabase client not loaded');
    const { data, error } = await db.auth.getSession();
    if (error || !data.session) throw new Error('Please sign in to checkout');
    const { data: result, error: rpcError } = await db.rpc('vasi_checkout_total', {
      p_subtotal: Number(subtotal),
      p_promo_code: promoCode || null
    });
    if (rpcError) throw rpcError;
    return result;
  }
  return { calculate };
})();