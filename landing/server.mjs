import { createServer } from 'node:http';
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const waitlistFile = resolve(process.env.WAITLIST_FILE || resolve(root, 'data/waitlist.jsonl'));
const assetsRoot = resolve(root, 'assets');
const knownEmails = new Set();
const rateLimits = new Map();
let writeQueue = Promise.resolve();

try {
  const existing = await readFile(waitlistFile, 'utf8');
  for (const line of existing.split('\n').filter(Boolean)) {
    try { knownEmails.add(JSON.parse(line).email); } catch { /* Ignore an incomplete final line. */ }
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function saveSignup(signup) {
  const job = writeQueue.then(async () => {
    if (knownEmails.has(signup.email)) return;
    await mkdir(dirname(waitlistFile), { recursive: true });
    await appendFile(waitlistFile, `${JSON.stringify(signup)}\n`, { encoding: 'utf8', mode: 0o600 });
    knownEmails.add(signup.email);
  });
  writeQueue = job.catch(() => {});
  await job;
}

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'");
  const url = new URL(request.url || '/', 'http://localhost');

  if (url.pathname === '/api/waitlist') {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return json(response, 405, { error: 'Please submit the signup form.' });
    }
    if (!(request.headers['content-type'] || '').startsWith('application/json')) return json(response, 415, { error: 'Please submit the signup form.' });
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}` && request.headers.origin !== `https://${request.headers.host}`) return json(response, 403, { error: 'Please submit from this website.' });
    const key = request.socket.remoteAddress || 'local';
    const now = Date.now();
    let limit = rateLimits.get(key);
    if (!limit || limit.expires < now) { limit = { count: 0, expires: now + 3600000 }; rateLimits.set(key, limit); }
    if (++limit.count > 25) return json(response, 429, { error: 'Please wait a little before trying again.' });
    try {
      let raw = '';
      for await (const chunk of request) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 8192) return json(response, 413, { error: 'Please submit a shorter form.' });
      }
      let data;
      try { data = JSON.parse(raw); } catch { return json(response, 400, { error: 'Please check the form and try again.' }); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return json(response, 400, { error: 'Please check the form and try again.' });
      if (data.website) return json(response, 202, { ok: true });
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(response, 400, { error: 'Please enter a valid email address.' });
      if (!['solo', 'studio', 'practice', 'undecided'].includes(data.plan)) return json(response, 400, { error: 'Please choose one of the available plans.' });
      if (!['monthly', 'yearly'].includes(data.billing)) return json(response, 400, { error: 'Please choose a billing preference.' });
      await saveSignup({ email, plan: data.plan, billing: data.billing, createdAt: new Date().toISOString() });
      return json(response, 202, { ok: true });
    } catch {
      return json(response, 500, { error: 'We couldn’t save your interest just now. Please try again.' });
    }
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    response.setHeader('Allow', 'GET, HEAD');
    return json(response, 405, { error: 'Method not allowed.' });
  }
  const staticFiles = new Map([['/', 'index.html'], ['/index.html', 'index.html'], ['/styles.css', 'styles.css'], ['/script.js', 'script.js'], ['/favicon.svg', 'favicon.svg']]);
  let file = staticFiles.has(url.pathname) ? resolve(root, staticFiles.get(url.pathname)) : null;
  if (!file && /^\/assets\/[a-zA-Z0-9._/-]+$/.test(url.pathname)) {
    const candidate = resolve(root, `.${url.pathname}`);
    if (candidate.startsWith(`${assetsRoot}${sep}`) && ['.woff2', '.woff', '.svg', '.png', '.webp', '.jpg'].includes(extname(candidate))) file = candidate;
  }
  if (!file) return json(response, 404, { error: 'Page not found.' });
  try {
    const content = await readFile(file);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error.code === 'ENOENT') return json(response, 404, { error: 'Page not found.' });
    return json(response, 500, { error: 'Unable to open this page.' });
  }
});

server.on('error', error => { console.error(`Could not start the preview: ${error.message}`); process.exitCode = 1; });
server.listen(port, host, () => { console.log(`schedulefa.st is ready at http://${host}:${port}`); console.log('Early-access requests are saved locally. No email is sent and no payment is collected.'); });
const cleanup = setInterval(() => { const now = Date.now(); for (const [key, value] of rateLimits) if (value.expires < now) rateLimits.delete(key); }, 3600000);
cleanup.unref();
