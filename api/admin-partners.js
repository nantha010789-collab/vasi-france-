import { callAdminService, parseBody, sendAdminResult } from './_admin-service.js';

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  const action = req.method === 'GET' ? 'list_partners' : 'review_partner';
  const payload = req.method === 'GET'
    ? { status: req.query.status }
    : parseBody(req);
  return sendAdminResult(res, await callAdminService(req, action, payload), req.method === 'GET' ? 'partners' : 'partner');
}
