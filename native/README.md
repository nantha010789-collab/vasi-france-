# VASI native store shells

Separate Capacitor projects are kept outside the production web package so the existing VASI web deployment is not changed.

Apps:
- Customer: `eu.vasigo.customer`
- Driver: `eu.vasigo.driver`
- Restaurant partner: `eu.vasigo.partner`

These shells are intended for TestFlight / internal Play testing first. They point at the production VASI web surfaces while native capabilities are migrated incrementally.

## Build
From one app folder:

```bash
npm install
npm run ios:add
npm run android:add
npm run sync
npm run open:ios
# or
npm run open:android
```

Before public store submission:
1. Add signed native icons/splash resources from the existing role-specific VASI artwork.
2. Configure iOS location, camera, microphone and notification usage descriptions only for features actually used.
3. Configure Android runtime permissions and notification channels.
4. Replace remote-only screens with packaged/native equivalents where store review requires stronger native integration.
5. Run the complete customer/driver/partner acceptance checklist on real iPhone and Android devices.
6. Complete App Store privacy disclosures and Google Play Data safety declarations from the VASI data map.
7. Provide reviewer test accounts and review notes.
