# VASI production operations

## Canonical production

- Customer app: `https://vasi-new.vercel.app/`
- GitHub Pages is a static mirror only. All API-backed acceptance tests must use the Vercel URL.
- Every main-branch change must pass `npm test` before deployment.

## Backup and recovery gate

Before accepting real rides or orders, an owner must confirm in Supabase **Project Settings → Infrastructure → Backups** that daily backups are present. Enable Point-in-Time Recovery for the production project when the plan supports it.

Monthly recovery drill:

1. Record the latest successful backup timestamp.
2. Restore it into an isolated recovery project, never over production.
3. Verify row counts for `profiles`, `rides`, `payments`, `restaurants`, `eats_orders`, and `delivery_orders`.
4. Verify Auth users and Storage partner documents are available.
5. Run `npm test` and one test booking against the isolated project.
6. Record recovery time, result, and the person who approved the drill.

Never commit database passwords, service-role keys, Stripe secrets, TURN credentials, or backup download links.

## Incident recovery

1. Pause new booking entry points if data integrity is at risk.
2. Preserve Vercel and Supabase logs before changing production.
3. Roll back the Vercel deployment to the last READY commit.
4. Restore the database only after confirming the exact recovery timestamp and business impact.
5. Validate login, booking, dispatch, trip completion, payment, receipt, Eats, Delivery, chat, and voice-call signalling before reopening.

## Voice-call networking

WebRTC uses authenticated Supabase signalling and STUN by default. For reliable calls across restrictive mobile networks, configure `VASI_TURN_URLS`, `VASI_TURN_USERNAME`, and `VASI_TURN_CREDENTIAL` in Vercel production settings. Use time-limited TURN credentials from the chosen provider.
