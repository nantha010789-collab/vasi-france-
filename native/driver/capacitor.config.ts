import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'eu.vasigo.driver',
  appName: 'VASI Driver',
  webDir: 'www',
  server: {
    url: 'https://vasi-new.vercel.app/driver-home.html',
    cleartext: false,
    allowNavigation: [
      'vasi-new.vercel.app',
      'vasigo.eu',
      'www.vasigo.eu',
      '*.stripe.com',
      '*.googleapis.com',
      '*.google.com',
      'waze.com',
      '*.waze.com'
    ]
  },
  ios: { contentInset: 'automatic' },
  android: { allowMixedContent: false }
};

export default config;
