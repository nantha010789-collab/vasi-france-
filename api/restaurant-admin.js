import { callAdminService, parseBody, sendAdminResult } from './_admin-service.js';

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  const body = req.method === 'PATCH' ? parseBody(req) : {};
  const photoMode = req.method === 'GET'
    ? req.query.mode === 'photos'
    : Boolean(body.photo_id);
  const action = req.method === 'GET'
    ? (photoMode ? 'list_menu_photo_reviews' : 'list_restaurants')
    : (photoMode ? 'review_menu_photo' : 'review_restaurant');
  const payload = req.method === 'GET'
    ? { status: req.query.status }
    : body;
  return sendAdminResult(res, await callAdminService(req, action, payload));
}
