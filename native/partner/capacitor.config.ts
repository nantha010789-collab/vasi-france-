import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'eu.vasigo.partner',
  appName: 'VASI Partner',
  webDir: 'www',
  server: {
    url: 'https://vasi-new.vercel.app/partner.html',
    cleartext: false,
    allowNavigation: [
      'vasi-new.vercel.app',
      'vasigo.eu',
      'www.vasigo.eu',
      '*.stripe.com'
    ]
  },
  ios: { contentInset: 'automatic' },
  android: { allowMixedContent: false }
};

export default config;
