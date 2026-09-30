// scan-bridge-src.js — bundled with esbuild into www/scan-bridge.js
// Exposes window.__scanPriceTag(): opens the camera, runs on-device ML Kit OCR,
// resolves with the recognized text. Native (Capacitor) only.
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Ocr } from '@jcesarmobile/capacitor-ocr';

function isNative() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (e) {
    return false;
  }
}

function fail(code) {
  const e = new Error(code);
  e.code = code;
  throw e;
}

window.__scanPriceTag = async function () {
  if (!isNative()) fail('not-native');

  let perm = null;
  try {
    perm = await Camera.checkPermissions();
  } catch (e) {
    perm = null;
  }
  if (!perm || perm.camera !== 'granted') {
    try {
      perm = await Camera.requestPermissions({ permissions: ['camera'] });
    } catch (e) {
      perm = { camera: 'denied' };
    }
  }
  if (!perm || perm.camera !== 'granted') fail('permission-denied');

  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    saveToGallery: false
  });

  let p = photo && photo.path ? photo.path : null;
  if (!p) fail('no-photo');
  if (p.indexOf('file://') !== 0 && p.indexOf('content://') !== 0) p = 'file://' + p;

  const res = await Ocr.process({ image: p });
  const lines = (res && res.results ? res.results : []).map(function (r) { return r.text; });
  return lines.join('\n');
};

window.__scanAvailable = function () {
  return isNative() && typeof window.__scanPriceTag === 'function';
};
