# edunex-site
The site for EduNex / Сайта за EduNex

## Стартиране

```bash
cp .env.example .env
npm start
```

Преди стартиране попълнете реални Google OAuth и Microsoft Entra ID
credentials в `.env`. Redirect URI адресите от `.env` трябва да бъдат добавени
към съответните OAuth приложения. Ако credentials липсват, backend-ът отказва
OAuth заявката и не симулира удостоверяване.

Регистрацията създава профил само след успешно OAuth удостоверяване. Паролата
за EduNex, ако бъде зададена за последващ локален вход, се съхранява като
`scrypt` hash; пароли на Google или Microsoft не се получават и не се съхраняват.

## OAuth конфигурация

И двете OAuth конфигурации са в `server.js`, във функцията `providerConfig`
(Google около ред 266, Microsoft около ред 278). Client ID, Client Secret и
Redirect URI се задават само чрез environment variables от `.env`, описани в
`.env.example`:

- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback/google`
- Microsoft: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`,
  `MICROSOFT_TENANT_ID`, `MICROSOFT_REDIRECT_URI=http://localhost:3000/auth/callback/microsoft`

Добавете `http://localhost:3000/auth/callback/google` в Google Cloud Console
под **APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect
URIs**. Създайте OAuth client от тип **Web application**, копирайте Client ID
и Client Secret в `.env`, и активирайте OAuth consent screen с email/profile
scopes.

Добавете `http://localhost:3000/auth/callback/microsoft` в Microsoft Entra
admin center: **Applications → App registrations → New registration**,
добавете redirect URI от тип **Web**, създайте secret от **Certificates &
secrets**, и копирайте Application (client) ID, secret value и Directory
(tenant) ID в `.env`. За multi-tenant или лични Microsoft акаунти оставете
`MICROSOFT_TENANT_ID=common`; за организация използвайте конкретния tenant ID.

След OAuth callback `server.js` валидира `state`, PKCE, `nonce`, JWT подписа,
issuer, audience, срока на токена и provider identity. Google изисква
`email_verified=true`; Microsoft се приема само при наличие на `email` claim,
а `preferred_username` сам по себе си не се използва за доказване на имейл.
