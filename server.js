import { createServer } from 'node:http';
import { createHash, createPublicKey, createVerify, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const dataDirectory = join(root, 'data');
const usersFile = join(dataDirectory, 'users.json');
const sessions = new Map();
const oauthStates = new Map();
const users = new Map();

await loadUsers();

const port = Number(process.env.PORT || 3000);
const appOrigin = process.env.APP_ORIGIN || `http://localhost:${port}`;
const isProduction = process.env.NODE_ENV === 'production';

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, appOrigin);

    if (request.method === 'GET' && requestUrl.pathname === '/auth/callback/google') {
      await finishOAuth(request, response, 'google', requestUrl);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/auth/callback/microsoft') {
      await finishOAuth(request, response, 'microsoft', requestUrl);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname.startsWith('/auth/')) {
      await startOAuth(request, response, requestUrl.pathname.split('/')[2], requestUrl.searchParams.get('mode'));
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/auth/register') {
      await register(request, response);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/auth/session') {
      sendJson(response, 200, { authenticated: Boolean(getSession(request)) });
      return;
    }

    await serveStatic(request, response, requestUrl.pathname);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Възникна вътрешна грешка.' });
  }
});

server.listen(port, () => {
  console.log(`EduNex server running at ${appOrigin}`);
});

async function startOAuth(request, response, provider, mode) {
  if (!['google', 'microsoft'].includes(provider)) {
    sendJson(response, 404, { error: 'Неподдържан доставчик.' });
    return;
  }

  const config = providerConfig(provider);
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    sendJson(response, 503, { error: `${provider} OAuth не е конфигуриран.` });
    return;
  }

  const state = randomBytes(32).toString('hex');
  const verifier = randomBytes(48).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  oauthStates.set(state, {
    provider,
    mode: mode === 'register' ? 'register' : 'login',
    verifier,
    nonce,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  const authorizationUrl = new URL(config.authorizationEndpoint);
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scope,
    state,
    nonce,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256'
  });

  response.writeHead(302, { Location: authorizationUrl });
  response.end();
}

async function finishOAuth(request, response, provider, requestUrl) {
  const state = oauthStates.get(requestUrl.searchParams.get('state'));
  oauthStates.delete(requestUrl.searchParams.get('state'));

  if (!state || state.provider !== provider || state.expiresAt < Date.now()) {
    redirectWithError(response, 'Невалидна OAuth сесия.');
    return;
  }
  if (requestUrl.searchParams.has('error') || !requestUrl.searchParams.get('code')) {
    redirectWithError(response, requestUrl.searchParams.get('error_description') || 'Достъпът бе отказан.');
    return;
  }

  const config = providerConfig(provider);
  const tokenResponse = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: requestUrl.searchParams.get('code'),
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: state.verifier
    })
  });
  if (!tokenResponse.ok) {
    redirectWithError(response, 'Доставчикът не потвърди удостоверяването.');
    return;
  }

  const token = await tokenResponse.json();
  const identity = await verifyIdentityToken(provider, token.id_token, state.nonce);
  if (!identity) {
    redirectWithError(response, 'Доставчикът не върна валидна проверена самоличност.');
    return;
  }

  const userKey = `${provider}:${identity.issuer}:${identity.subject}`;
  const existingUser = users.get(userKey);
  if (state.mode === 'login' && !existingUser) {
    redirectWithError(response, 'Няма регистриран акаунт за тази самоличност. Изберете „Регистрация“.');
    return;
  }
  if (state.mode === 'register' && existingUser) {
    redirectWithError(response, 'Тази самоличност вече има акаунт. Изберете „Вход“.');
    return;
  }

  const sessionId = createSession({
    userKey,
    oauthVerified: state.mode === 'register',
    identity: state.mode === 'register' ? identity : null
  });
  setSessionCookie(response, sessionId);
  response.writeHead(302, {
    Location: state.mode === 'register' ? '/auth.html#register' : '/success.html?type=login'
  });
  response.end();
}

async function register(request, response) {
  const session = getSession(request);
  if (!session?.oauthVerified) {
    sendJson(response, 403, { error: 'Първо завършете удостоверяване чрез Google или Microsoft.' });
    return;
  }

  const body = await readJson(request);
  if (!body.name || !body.role || !body.email || !body.password || body.password !== body.passwordConfirmation) {
    sendJson(response, 400, { error: 'Попълнете всички полета и потвърдете паролата.' });
    return;
  }
  if (body.password.length < 12) {
    sendJson(response, 400, { error: 'Паролата трябва да съдържа поне 12 символа.' });
    return;
  }

  const identity = session.identity;
  if (!identity || typeof body.email !== 'string' ||
      body.email.trim().toLowerCase() !== identity.email) {
    sendJson(response, 400, { error: 'Въведеният имейл не съвпада с удостоверения имейл.' });
    return;
  }
  if (users.has(session.userKey)) {
    sendJson(response, 409, { error: 'Тази самоличност вече има регистриран акаунт.' });
    return;
  }
  const user = {
    id: randomBytes(16).toString('hex'),
    provider: identity.provider,
    providerIssuer: identity.issuer,
    providerSubject: identity.subject,
    email: identity.email,
    name: body.name,
    role: body.role,
    passwordHash: await hashPassword(body.password),
    createdAt: new Date().toISOString()
  };
  users.set(session.userKey, user);
  session.oauthVerified = false;
  session.identity = null;
  await persistUsers();
  sendJson(response, 200, { authenticated: true });
}

async function verifyIdentityToken(provider, token, expectedNonce) {
  if (!token) return null;

  const config = providerConfig(provider);
  const claims = decodeJwt(token);
  if (!claims || claims.aud !== config.clientId || claims.nonce !== expectedNonce ||
      typeof claims.exp !== 'number' || claims.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  if (provider === 'google') {
    if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) ||
        claims.email_verified !== true || !claims.email || !claims.sub) {
      return null;
    }
  } else if (!claims.iss?.startsWith('https://login.microsoftonline.com/') ||
             !claims.iss.endsWith('/v2.0') || !claims.email || !claims.sub) {
    return null;
  }

  const jwksResponse = await fetch(config.jwksEndpoint);
  if (!jwksResponse.ok) return null;
  const jwks = await jwksResponse.json();
  const jwk = jwks.keys?.find((key) => key.kid === claims.header.kid && key.kty === 'RSA');
  if (!jwk || claims.header.alg !== 'RS256') return null;

  const verifier = createVerify('RSA-SHA256');
  verifier.update(claims.encodedHeader + '.' + claims.encodedPayload);
  verifier.end();
  if (!verifier.verify(createPublicKey({ key: jwk, format: 'jwk' }), claims.signature)) {
    return null;
  }

  return {
    provider,
    issuer: claims.iss,
    subject: claims.sub,
    email: claims.email.trim().toLowerCase(),
    name: claims.name || ''
  };
}

function decodeJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return {
      ...payload,
      header,
      encodedHeader: parts[0],
      encodedPayload: parts[1],
      signature: Buffer.from(parts[2], 'base64url')
    };
  } catch {
    return null;
  }
}

function providerConfig(provider) {
  if (provider === 'google') {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      jwksEndpoint: 'https://www.googleapis.com/oauth2/v3/certs',
      scope: 'openid email profile'
    };
  }

  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
  return {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI,
    authorizationEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    jwksEndpoint: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
    scope: 'openid profile email User.Read'
  };
}

function createSession(values) {
  const id = randomBytes(32).toString('base64url');
  sessions.set(id, { ...values, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  return id;
}

function getSession(request) {
  const sessionId = parseCookies(request.headers.cookie || '').edunex_session;
  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

function setSessionCookie(response, sessionId) {
  const secure = isProduction ? '; Secure' : '';
  response.setHeader('Set-Cookie', `edunex_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`);
}

function redirectWithError(response, error) {
  response.writeHead(302, { Location: `/auth.html?error=${encodeURIComponent(error)}#login` });
  response.end();
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [, saltHex, keyHex] = storedHash.split('$');
  if (!saltHex || !keyHex) return false;
  const derivedKey = await scryptAsync(password, Buffer.from(saltHex, 'hex'), 64);
  const expectedKey = Buffer.from(keyHex, 'hex');
  return expectedKey.length === derivedKey.length && timingSafeEqual(expectedKey, derivedKey);
}

function scryptAsync(password, salt, length) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

async function loadUsers() {
  try {
    const savedUsers = JSON.parse(await readFile(usersFile, 'utf8'));
    Object.entries(savedUsers).forEach(([key, user]) => users.set(key, user));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function persistUsers() {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(usersFile, JSON.stringify(Object.fromEntries(users), null, 2), { mode: 0o600 });
}

async function serveStatic(request, response, pathname) {
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Методът не е разрешен.' });
    return;
  }
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = normalize(join(root, requestedPath));
  if (!filePath.startsWith(root)) {
    sendJson(response, 403, { error: 'Достъпът е отказан.' });
    return;
  }
  try {
    const content = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': contentType(extname(filePath)) });
    response.end(content);
  } catch (error) {
    sendJson(response, error.code === 'ENOENT' ? 404 : 500, { error: 'Файлът не е намерен.' });
  }
}

function contentType(extension) {
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8'
  }[extension] || 'application/octet-stream';
}

function parseCookies(header) {
  return Object.fromEntries(header.split(';').map((part) => {
    const [key, ...value] = part.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.on('data', (chunk) => {
      data += chunk;
      if (data.length > 100_000) request.destroy();
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        reject(new Error('Невалидно JSON съдържание.'));
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}
