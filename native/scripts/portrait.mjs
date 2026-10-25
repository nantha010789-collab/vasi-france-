import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Run from a Capacitor app directory after platform generation and sync.
export function portraitAndroid(xml) {
  let found = false;
  const result = xml.replace(/<activity\b[^>]*>/g, tag => {
    if (!/android:name="(?:[^\"]*\.)?MainActivity"/.test(tag)) return tag;
    found = true;
    return /android:screenOrientation="[^"]*"/.test(tag)
      ? tag.replace(/android:screenOrientation="[^"]*"/, 'android:screenOrientation="portrait"')
      : tag.replace(/>$/, ' android:screenOrientation="portrait">');
  });
  if (!found) throw new Error('Cannot find MainActivity; portrait configuration was not applied.');
  return result;
}
export function portraitIOS(xml) {
  if (!xml.includes('<plist')) throw new Error('Expected an XML Info.plist.');
  for (const key of ['UISupportedInterfaceOrientations', 'UISupportedInterfaceOrientations~ipad']) {
    const value = `<key>${key}</key>\n\t<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>`;
    const pattern = new RegExp(`<key>${key}</key>\\s*<array>[\\s\\S]*?</array>`);
    xml = pattern.test(xml) ? xml.replace(pattern, value) : xml.replace(/<\/dict>\s*<\/plist>/, `${value}\n</dict>\n</plist>`);
  }
  return xml;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  for (const [path, transform] of [
    ['android/app/src/main/AndroidManifest.xml', portraitAndroid],
    ['ios/App/App/Info.plist', portraitIOS],
  ]) {
    if (!existsSync(path)) continue; // Platforms are generated separately.
    const before = readFileSync(path, 'utf8');
    const after = transform(before);
    if (after !== before) writeFileSync(path, after);
    console.log(`Portrait configured: ${path}`);
  }
}
