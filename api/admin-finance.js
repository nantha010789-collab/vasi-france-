import { callAdminService, parseBody, sendAdminResult } from './_admin-service.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return sendAdminResult(res, await callAdminService(req, 'list_finance'));
  if (req.method === 'POST') {
    return sendAdminResult(res, await callAdminService(req, 'pay_driver_activity_guarantee', parseBody(req)));
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
