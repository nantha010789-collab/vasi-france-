import test from 'node:test';
import assert from 'node:assert/strict';
import { portraitAndroid, portraitIOS } from '../native/scripts/portrait.mjs';
test('portrait applies only to Android MainActivity and survives repeated sync', () => {
 const original = '<manifest><activity android:name=".MainActivity" android:screenOrientation="landscape"></activity><activity android:name=".CameraActivity" android:screenOrientation="landscape"/></manifest>';
 const patched = portraitAndroid(original);
 assert.match(patched, /MainActivity" android:screenOrientation="portrait"/);
 assert.match(patched, /CameraActivity" android:screenOrientation="landscape"/);
 assert.equal(portraitAndroid(patched), patched);
 assert.throws(() => portraitAndroid('<manifest/>'), /MainActivity/);
});
test('iOS allows portrait without changing unrelated plist settings', () => {
 const original = '<plist><dict><key>CFBundleName</key><string>VASI</string><key>UISupportedInterfaceOrientations</key><array><string>UIInterfaceOrientationLandscapeLeft</string></array></dict></plist>';
 const patched = portraitIOS(original);
 assert.ok(!patched.includes('Landscape'));
 assert.match(patched, /CFBundleName<\/key><string>VASI/);
 assert.match(patched, /UISupportedInterfaceOrientations~ipad/);
 assert.equal(portraitIOS(patched), patched);
});
