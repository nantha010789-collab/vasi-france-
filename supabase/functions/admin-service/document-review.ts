// Human review evidence is not an automated authenticity/biometric verdict.
export const reviewChecks = ['document_opened','type_correct','details_match','original_checked','validity_checked','cross_document_match','selfie_match'];
export const expiringDocuments = ['identity','vtc','licence','insurance'];
export function reviewIssue(checks: any, note: unknown) {
  if (!checks || reviewChecks.some(key => checks[key] !== true)) return 'Complete every manual document review check; a matching name alone is insufficient.';
  if (typeof note !== 'string' || note.trim().length < 20 || note.length > 1000) return 'Record a review note (20–1000 characters), including the evidence/source checked.';
  return null;
}
export function fileFormat(bytes: Uint8Array) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value)) return 'image/png';
  if ([37,80,68,70,45].every((value,index) => bytes[index] === value)) return 'application/pdf';
  return null;
}
export async function inspectFiles(db: any, owner: string, paths: Record<string,string>) {
  const hashes: Record<string,string> = {};
  for (const [kind,path] of Object.entries(paths)) {
    if (typeof path !== 'string' || !path.startsWith(owner + '/') || path.includes('..')) throw new Error('Invalid document ownership: ' + kind);
    const { data: blob, error } = await db.storage.from('partner-documents').download(path);
    if (error || !blob) throw new Error('Document unavailable: ' + kind);
    if (blob.size < 12 || blob.size > 10 * 1024 * 1024) throw new Error('Empty or oversized document: ' + kind);
    const bytes = new Uint8Array(await blob.arrayBuffer()), format = fileFormat(bytes);
    if (!format || (['identity','identity_back','selfie'].includes(kind) && format === 'application/pdf')) throw new Error('Invalid document format: ' + kind);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value => value.toString(16).padStart(2,'0')).join('');
    if (Object.values(hashes).includes(hash)) throw new Error('Identical file reused for different documents: ' + kind);
    hashes[kind] = hash;
  }
  return hashes;
}
