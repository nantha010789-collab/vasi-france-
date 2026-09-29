import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'eu.vasigo.customer',
  appName: 'VASI',
  webDir: 'www',
  server: {
    url: 'https://vasi-new.vercel.app/app.html',
    cleartext: false,
    allowNavigation: [
      'vasi-new.vercel.app',
      'vasigo.eu',
      'www.vasigo.eu',
      '*.stripe.com',
      '*.googleapis.com',
      '*.google.com'
    ]
  },
  ios: { contentInset: 'automatic' },
  android: { allowMixedContent: false }
};

export default config;
