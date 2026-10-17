import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecipient, recipientOnboarding } from '../supabase/functions/_shared/stripe-connect.js';

test('new recipients preserve platform liability and use a stable idempotency key', async () => {
  const original = global.fetch;
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.stripe.com/v2/core/accounts');
      assert.equal(options.headers['Stripe-Version'], '2026-09-30.endive');
      assert.equal(options.headers['Idempotency-Key'], 'vasi-driver-account-v2-123');
      const body=JSON.parse(options.body);
      assert.equal(body.identity.country,'FR');
      assert.equal(body.contact_email,'test@example.test');
      assert.deepEqual(body.defaults.responsibilities,{fees_collector:'application',losses_collector:'application'});
      assert.equal(body.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested,true);
      assert.equal(body.metadata.vasi_connect_api,'v2');
      assert.equal(body.metadata.vasi_driver_id,'123');
      return Response.json({id:'acct_new',metadata:body.metadata});
    };
    assert.equal((await createRecipient('sk_test_fixture',{name:'Driver',email:'test@example.test',metadata:{vasi_driver_id:'123'},idempotencyKey:'vasi-driver-account-v2-123'})).id,'acct_new');
  } finally {global.fetch=original;}
});

test('recipient link requests recipient onboarding and rejects non-Stripe redirects', async () => {
  const original=global.fetch;
  try {
    global.fetch=async (url,options)=>{
      assert.equal(url,'https://api.stripe.com/v2/core/account_links');
      assert.deepEqual(JSON.parse(options.body),{account:'acct_new',use_case:{type:'account_onboarding',account_onboarding:{configurations:['recipient'],refresh_url:'https://www.vasigo.eu/driver.html?stripe=refresh',return_url:'https://www.vasigo.eu/driver.html?stripe=complete'}}});
      return Response.json({url:'https://accounts.stripe.com/r/test'});
    };
    const args=['sk_test_fixture',{id:'acct_new'},'https://www.vasigo.eu/driver.html?stripe=refresh','https://www.vasigo.eu/driver.html?stripe=complete'];
    assert.equal((await recipientOnboarding(...args)).url,'https://accounts.stripe.com/r/test');
    global.fetch=async()=>Response.json({url:'https://accounts.stripe.com.attacker.test/r/test'});
    await assert.rejects(recipientOnboarding(...args),/Invalid Stripe onboarding URL/);
  } finally {global.fetch=original;}
});

test('missing key and Stripe owner-review errors stop onboarding without pretending success', async () => {
  const original=global.fetch;
  try {
    let calls=0;
    global.fetch=async()=>{calls++;return Response.json({error:{message:'Review connected-account loss responsibilities'}},{status:400});};
    await assert.rejects(createRecipient('',{}),e=>e.status===503);
    assert.equal(calls,0);
    await assert.rejects(createRecipient('sk_test_fixture',{metadata:{}}),e=>e.status===400&&/loss responsibilities/.test(e.message));
  } finally {global.fetch=original;}
});
