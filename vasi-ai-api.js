/* VASI AI integration boundary. No provider key is stored in client code. */
window.VASI_AI = (() => {
  const SUPABASE_URL = 'https://vhfyvkrvysrooaqzcxsp.supabase.co';
  const FUNCTION = SUPABASE_URL + '/functions/v1/ai-assistant';
  async function request(task, input = {}) {
    if (!window.supabase) throw new Error('Supabase client not loaded');
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) throw new Error('Please sign in');
    const r = await fetch(FUNCTION, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, input })
    });
    if (!r.ok) throw new Error('AI service unavailable');
    return r.json();
  }
  return {
    request,
    matchDriver: input => request('driver_matching', input),
    estimateEta: input => request('eta_prediction', input),
    support: input => request('customer_support', input),
    recommendEats: input => request('eats_recommendation', input)
  };
})();