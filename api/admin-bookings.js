import { callAdminService, parseBody, sendAdminResult } from './_admin-service.js';

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  const action = req.method === 'GET' ? 'list_bookings' : 'update_booking';
  const result = await callAdminService(req, action, req.method === 'PATCH' ? parseBody(req) : {});
  return sendAdminResult(res, result, req.method === 'GET' ? 'bookings' : 'booking');
}
