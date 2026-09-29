# VASI privacy data map for store forms

Use this as the source checklist when completing Apple App Privacy and Google Play Data safety. Verify each item against production before submission.

VASI may process:
- Contact information: phone number, email, account profile details.
- Precise location: customer pickup/destination and driver/courier live location while providing service.
- User content: support messages, ride chat, restaurant menu content and uploaded partner documents/photos.
- Purchase/payment information: transaction status and payment identifiers handled with Stripe; full card details must not be stored by VASI.
- Identifiers: authenticated user/account IDs, ride/order IDs and device/push subscription identifiers.
- Operational data: ride/order history, fares, commissions, payout status and ratings.
- Diagnostics/security: logs needed for reliability, abuse prevention, fraud review and support.

Do not claim data is unlinked, not collected, or not retained unless production behavior and policy support that claim. Do not declare advertising tracking unless VASI actually adds advertising/tracking SDKs.
