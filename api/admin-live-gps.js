import { callAdminService, sendAdminResult } from './_admin-service.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  return sendAdminResult(res, await callAdminService(req, 'live_gps'));
}
