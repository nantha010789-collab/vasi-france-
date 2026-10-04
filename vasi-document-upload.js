(function () {
  'use strict';
  function format(bytes) {
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
    if ([137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value)) return 'image/png';
    if ([37,80,68,70,45].every((value,index) => bytes[index] === value)) return 'application/pdf';
    return null;
  }
  async function validate(entries) {
    const seen = new Map();
    for (const [kind,file] of entries) {
      if (!file || file.size < 12 || file.size > 10 * 1024 * 1024) throw new Error('Fichier vide ou trop volumineux : ' + kind);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const actual = format(bytes);
      if (!actual || actual !== file.type || (['identity','identity_back','selfie'].includes(kind) && actual === 'application/pdf')) throw new Error('Format réel du fichier non accepté : ' + kind);
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value => value.toString(16).padStart(2,'0')).join('');
      if (seen.has(digest)) throw new Error('Le même fichier ne peut pas servir pour deux justificatifs différents : ' + seen.get(digest) + ' / ' + kind);
      seen.set(digest,kind);
    }
  }
  window.VasiDocumentUpload = { format, validate };
})();
