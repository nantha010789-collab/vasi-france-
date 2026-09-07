import { callAdminService, parseBody, sendAdminResult } from './_admin-service.js';

export default async function handler(req, res) {
  if (req.method === 'GET')
    return sendAdminResult(res, await callAdminService(req, 'list_deletions'));
  if (req.method === 'PATCH')
    return sendAdminResult(res, await callAdminService(req, 'update_deletion', parseBody(req)));
  return res.status(405).json({ error: 'Method not allowed' });
}
