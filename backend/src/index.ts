import 'dotenv/config';
import { createServer } from 'node:http';

import { allowNutritionRequest, allowRequest, requestKey } from './middleware/limits.js';
import { analyzeRoute } from './routes/analyze.js';
import { nutritionBarcodeRoute, nutritionSearchRoute } from './routes/nutrition.js';

const port = Number(process.env.PORT ?? 8787);
const origin = process.env.ALLOWED_ORIGIN ?? '*';

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  if (request.method === 'GET' && request.url === '/health') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ ok: true })); return; }
  if (request.method === 'POST' && request.url === '/analyze') {
    if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') { response.writeHead(415, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: 'La solicitud debe usar application/json' })); return; }
    if (!allowRequest(requestKey(request))) { response.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '300' }); response.end(JSON.stringify({ error: 'Límite temporal alcanzado' })); return; }
    await analyzeRoute(request, response); return;
  }
  if (request.method === 'GET' && request.url?.startsWith('/nutrition/search')) {
    if (!allowNutritionRequest(requestKey(request))) { response.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' }); response.end(JSON.stringify({ error: 'Límite temporal de búsquedas nutricionales alcanzado' })); return; }
    await nutritionSearchRoute(request, response); return;
  }
  if (request.method === 'GET' && request.url?.startsWith('/nutrition/barcode/')) {
    if (!allowNutritionRequest(requestKey(request))) { response.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' }); response.end(JSON.stringify({ error: 'Límite temporal de búsquedas nutricionales alcanzado' })); return; }
    await nutritionBarcodeRoute(request, response); return;
  }
  response.writeHead(404, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

server.listen(port, '0.0.0.0', () => console.log(`MacroMind backend escuchando en http://0.0.0.0:${port}`));
