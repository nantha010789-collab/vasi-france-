// New recipients use Accounts v2. Existing v1 accounts keep their original flow.
export async function connectRequest(key, path, body, idempotencyKey) {
  if (!key) throw Object.assign(new Error('Stripe payout service is not configured'), {status:503});
  const response = await fetch(`https://api.stripe.com/v2/core/${path}`, {
    method:'POST',
    headers:{Authorization:`Bearer ${key}`, 'Stripe-Version':'2026-09-30.endive',
      'Content-Type':'application/json', ...(idempotencyKey ? {'Idempotency-Key':idempotencyKey} : {})},
    body:JSON.stringify(body), signal:AbortSignal.timeout(18000),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || 'Stripe Connect request failed'), {status:response.status});
  return data;
}

export function createRecipient(key, {name, email, metadata, idempotencyKey}) {
  return connectRequest(key, 'accounts', {
    identity:{country:'FR'}, display_name:name,
    ...(email ? {contact_email:email} : {}), dashboard:'express',
    defaults:{currency:'eur',responsibilities:{fees_collector:'application',losses_collector:'application'}},
    configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},
    metadata:{...metadata,vasi_connect_api:'v2'},
  }, idempotencyKey);
}

export async function recipientOnboarding(key, account, refreshUrl, returnUrl) {
  const link = await connectRequest(key, 'account_links', {
    account:account.id,
    use_case:{type:'account_onboarding',account_onboarding:{
      configurations:['recipient'], refresh_url:refreshUrl, return_url:returnUrl,
    }},
  });
  if (!/^https:\/\/(accounts|connect)\.stripe\.com\//.test(link?.url || ''))
    throw Object.assign(new Error('Invalid Stripe onboarding URL'), {status:502});
  return link;
}
