# VASI Store Release Checklist

## Customer app
- [ ] Sign in / OTP works on fresh install
- [ ] Location permission has a clear purpose string
- [ ] Pickup, destination, route, fare and booking work
- [ ] Card / Apple Pay / Google Pay test flow works
- [ ] Safety Centre, 112, trip share and account deletion work
- [ ] Push notifications work
- [ ] Privacy Policy and Terms are reachable before login
- [ ] No test OTP, debug shortcuts or demo-only links are visible

## Driver app
- [ ] Separate driver session and bundle identity
- [ ] Driver onboarding / document review works
- [ ] Online/offline state, GPS and ride offers work
- [ ] PIN start, navigation, completion and earnings work
- [ ] RIB / Stripe onboarding and payout state are clear
- [ ] Foreground location behavior is tested on real devices
- [ ] Any future background location request is justified and separately reviewed

## Restaurant partner app
- [ ] Separate restaurant session and bundle identity
- [ ] Approval, opening status, menu and photos work
- [ ] Orders, substitutions/refunds and payout status work
- [ ] Push notifications work

## Store operations
- [ ] Apple Developer account active
- [ ] Google Play Console account active
- [ ] Unique signing certificates / keys backed up securely
- [ ] App icons and screenshots prepared for phone sizes
- [ ] French primary listing + English secondary listing
- [ ] Support URL, Privacy URL and account-deletion URL verified
- [ ] Reviewer credentials prepared
- [ ] App privacy / Data safety forms completed from actual production behavior
- [ ] TestFlight and Play Internal Testing pass before public review
