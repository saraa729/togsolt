'use strict';

const crypto = require('crypto');
const { hashPassword } = require('../auth/security');

module.exports = function registerAuth(ctx) {
  const {
    route,
    ROLES,
    db,
    now,
    id,
    httpError,
    verifyPassword,
    createUserRecord,
    saveState,
    audit,
    publicUser,
    readJson,
    requireAuth,
    hasRole,
    issueAuthSession,
    rotateRefreshToken,
    revokeRefreshToken,
    mailer,
    sellerShop,
    assertText,
    assertSupportedLocale,
    runtimeStore
  } = ctx;

  const authResponse = (user, session) => ({
    user: publicUser(user),
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    token: session.accessToken
  });

  function cookieValue(req, name) {
    return String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  }

  function setRefreshCookie(ctx, refreshToken) {
    const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
    ctx.setCookie(ctx.res, `expocraft_refresh=${encodeURIComponent(refreshToken)}; HttpOnly; ${secure}SameSite=Strict; Path=/auth; Max-Age=${60 * 60 * 24 * 30}`);
  }

  function clearRefreshCookie(ctx) {
    ctx.setCookie(ctx.res, 'expocraft_refresh=; HttpOnly; SameSite=Strict; Path=/auth; Max-Age=0');
  }

  function assertStrongPassword(password) {
    const value = assertText(password, 'password', 8);
    if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
      throw httpError(422, 'weak_password', 'Password must include letters and numbers.');
    }
    return value;
  }

  async function assertLoginAllowed(email) {
    const entry = await runtimeStore.get(`login:${email}`);
    if (!entry) return;
    if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
      throw httpError(429, 'too_many_attempts', 'Too many login attempts. Try again later.');
    }
  }

  async function recordLoginFailure(email) {
    const entry = await runtimeStore.get(`login:${email}`) || { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= 5) entry.lockedUntil = Date.now() + 10 * 60 * 1000;
    await runtimeStore.set(`login:${email}`, entry, 10 * 60 * 1000);
  }

  async function clearLoginFailures(email) {
    await runtimeStore.del(`login:${email}`);
  }

  const registerUser = async (ctx) => {
    const body = await readJson(ctx.req);
    const requestedRoles = Array.isArray(body.roles) ? body.roles : [body.role || ROLES.BUYER];
    if (!requestedRoles.every((role) => [ROLES.BUYER, ROLES.SELLER].includes(role))) {
      throw httpError(422, 'invalid_role', 'Only buyer or seller registration is public.');
    }

    const roles = Array.from(new Set([ROLES.BUYER, ...requestedRoles]));
    const email = assertText(body.email, 'email').toLowerCase();
    if (db.users.some((user) => user.email === email)) {
      throw httpError(409, 'email_exists', 'Таны имэйл аль хэдийн бүртгэлтэй байна.');
    }

    const password = assertStrongPassword(body.password);
    const country = body.country || 'MN';
    if (country === 'MN' && roles.includes(ROLES.BUYER) && !body.phone) {
      throw httpError(422, 'phone_required', 'Phone is required for domestic buyers.');
    }

    const user = createUserRecord(email, password, roles, assertText(body.name || email, 'name'));
    user.locale = assertSupportedLocale(body.locale || 'mn');
    user.phone = body.phone || null;
    user.country = country;
    user.emailVerified = false;
    db.users.push(user);
    const verification = { id: id('evt'), userId: user.id, token: crypto.randomBytes(24).toString('base64url'), createdAt: now(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), usedAt: null };
    db.emailVerificationTokens = db.emailVerificationTokens || [];
    db.emailVerificationTokens.push(verification);

    audit(user.id, 'register', 'user', user.id);
    const session = issueAuthSession(user);
    setRefreshCookie(ctx, session.refreshToken);
    saveState(db);
    return authResponse(user, session);
  };

  function publicRegistrationRoles(body) {
    const requestedRoles = Array.isArray(body.roles) ? body.roles : [body.role || ROLES.BUYER];
    if (!requestedRoles.every((role) => [ROLES.BUYER, ROLES.SELLER].includes(role))) {
      throw httpError(422, 'invalid_role', 'Only buyer or seller registration is public.');
    }
    return Array.from(new Set([ROLES.BUYER, ...requestedRoles]));
  }

  function assertDomesticBuyerPhone({ country, roles, phone }) {
    if (country === 'MN' && roles.includes(ROLES.BUYER) && !phone) {
      throw httpError(422, 'phone_required', 'Phone is required for domestic buyers.');
    }
  }

  const loginUser = async (ctx) => {
    const body = await readJson(ctx.req);
    const email = String(body.email || '').toLowerCase();
    await assertLoginAllowed(email);
    const user = db.users.find((item) => item.email === email);
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      await recordLoginFailure(email);
      throw httpError(401, 'bad_credentials', 'Invalid email or password.');
    }
    if (user.disabled) throw httpError(403, 'account_disabled', 'This account is disabled.');
    await clearLoginFailures(email);

    user.lastLoginAt = now();
    audit(user.id, 'login', 'user', user.id);
    const session = issueAuthSession(user);
    setRefreshCookie(ctx, session.refreshToken);
    saveState(db);
    return authResponse(user, session);
  };

  const endpointInfo = (name) => ({
    ok: true,
    endpoint: name,
    method: 'POST',
    contentType: 'application/json'
  });

  route('GET', '/health', async () => ({ ok: true, service: 'expocraft-backend', time: now() }));

  route('GET', '/login', async () => endpointInfo('/login'));
  route('GET', '/register', async () => endpointInfo('/register'));
  route('GET', '/auth/login', async () => endpointInfo('/auth/login'));
  route('GET', '/auth/register', async () => endpointInfo('/auth/register'));
  route('GET', '/api/auth/login', async () => endpointInfo('/api/auth/login'));
  route('GET', '/api/auth/register', async () => endpointInfo('/api/auth/register'));

  ['/auth/register', '/register', '/api/auth/register'].forEach((path) => {
    route('POST', path, registerUser);
  });

  ['/auth/login', '/login', '/api/auth/login'].forEach((path) => {
    route('POST', path, loginUser);
  });

  /**
   * Google-ийн ID токеныг Google дээр нь баталгаажуулна.
   *
   * ЧУХАЛ: и-мэйлийг хүсэлтийн биеэс АВАХГҮЙ. Өмнө нь тэгдэг байсан тул хэн ч
   * дурын и-мэйл бичээд бүрэн эрхтэй сесс авах боломжтой байв (акаунт булаах).
   * Одоо зөвхөн Google-ийн гарын үсэгтэй токен дотор байгаа и-мэйлд итгэнэ.
   */
  async function verifyGoogleIdToken(credential) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw httpError(503, 'google_auth_unavailable', 'Google sign-in is not configured on this server.');
    }

    let payload;
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
      );
      if (!response.ok) throw new Error(`tokeninfo ${response.status}`);
      payload = await response.json();
    } catch {
      throw httpError(401, 'google_token_invalid', 'Google credential could not be verified.');
    }

    // Өөр аппликешнд олгосон токеныг хүлээж авбал тэр аппын хэрэглэгчээр нэвтэрч болно.
    if (payload.aud !== clientId) {
      throw httpError(401, 'google_token_audience', 'Google credential was issued for a different application.');
    }
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
      throw httpError(401, 'google_token_issuer', 'Google credential has an unexpected issuer.');
    }
    if (Number(payload.exp) * 1000 <= Date.now()) {
      throw httpError(401, 'google_token_expired', 'Google credential has expired.');
    }
    if (String(payload.email_verified) !== 'true') {
      throw httpError(401, 'google_email_unverified', 'Google account email is not verified.');
    }
    if (!payload.email) throw httpError(401, 'google_token_invalid', 'Google credential has no email.');

    return payload;
  }

  route('POST', '/auth/google', async (ctx) => {
    const body = await readJson(ctx.req);
    const claims = await verifyGoogleIdToken(assertText(body.credential, 'credential'));
    const email = String(claims.email).toLowerCase();
    // Нэр, sub-ыг ч баталгаажсан токеноос авна.
    body.name = body.name || claims.name || email;
    body.googleSubject = claims.sub;
    let user = db.users.find((item) => item.email === email);
    if (!user) {
      const roles = publicRegistrationRoles(body);
      const country = body.country || 'MN';
      assertDomesticBuyerPhone({ country, roles, phone: body.phone });
      user = createUserRecord(email, crypto.randomBytes(18).toString('base64url'), roles, body.name || email);
      user.authProviders = ['google'];
      user.googleSubject = body.googleSubject || body.sub || null;
      user.locale = assertSupportedLocale(body.locale || 'mn');
      user.country = country;
      user.phone = body.phone || null;
      user.emailVerified = true;
      db.users.push(user);
      audit(user.id, 'google_register', 'user', user.id);
    } else if (!user.authProviders.includes('google')) {
      throw httpError(409, 'google_link_required', 'This email already has a password-based account. Log in with your password and link Google from your account settings.');
    }
    user.lastLoginAt = now();
    const session = issueAuthSession(user);
    setRefreshCookie(ctx, session.refreshToken);
    saveState(db);
    return authResponse(user, session);
  });
  
  route('POST', '/auth/refresh', async (ctx) => {
    const body = await readJson(ctx.req);
    const rotated = rotateRefreshToken(body.refreshToken || decodeURIComponent(cookieValue(ctx.req, 'expocraft_refresh') || ''));
    setRefreshCookie(ctx, rotated.refreshToken);
    saveState(db);
    return authResponse(rotated.user, rotated);
  });
  
  route('POST', '/auth/logout', async (ctx) => {
    const body = await readJson(ctx.req);
    let user = null;
    try {
      user = requireAuth(ctx);
    } catch {
      user = null;
    }
    revokeRefreshToken(body.refreshToken || decodeURIComponent(cookieValue(ctx.req, 'expocraft_refresh') || ''), user?.id);
    clearRefreshCookie(ctx);
    saveState(db);
    return { ok: true };
  });

  route('POST', '/auth/verify-email', async (ctx) => {
    const body = await readJson(ctx.req);
    const token = assertText(body.token, 'token');
    const record = (db.emailVerificationTokens || []).find((item) => item.token === token && !item.usedAt);
    if (!record || new Date(record.expiresAt).getTime() < Date.now()) throw httpError(422, 'invalid_verification_token', 'Verification token is invalid or expired.');
    const user = db.users.find((item) => item.id === record.userId);
    if (!user) throw httpError(404, 'user_not_found', 'User was not found.');
    user.emailVerified = true;
    record.usedAt = now();
    audit(user.id, 'verify_email', 'user', user.id);
    saveState(db);
    return { ok: true, user: publicUser(user) };
  });

  route('POST', '/auth/forgot-password', async (ctx) => {
    const body = await readJson(ctx.req);
    const email = assertText(body.email, 'email').toLowerCase();
    const user = db.users.find((item) => item.email === email);
    if (user) {
      const reset = { id: id('prt'), userId: user.id, token: crypto.randomBytes(24).toString('base64url'), createdAt: now(), expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), usedAt: null };
      db.passwordResetTokens = db.passwordResetTokens || [];
      db.passwordResetTokens.push(reset);
      audit(user.id, 'request_password_reset', 'user', user.id);
      saveState(db);

      const link = `${process.env.EXPOCRAFT_WEB_ORIGIN || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(reset.token)}`;
      await mailer.send({
        to: user.email,
        subject: 'ExpoCraft — нууц үг сэргээх / Reset your password',
        text: `Нууц үгээ сэргээхийн тулд доорх холбоосыг нээнэ үү (1 цаг хүчинтэй):\n${link}\n\nOpen this link to reset your password (valid for 1 hour):\n${link}`
      });

      /*
       * SMTP тохируулсан үед токеныг хариунд БУЦААХГҮЙ — зөвхөн и-мэйлээр
       * хүрнэ. Тохируулаагүй хөгжүүлэлтийн орчинд урсгалыг шалгах боломжтой
       * байхын тулд буцаана.
       */
      return { ok: true, resetToken: mailer.enabled ? undefined : reset.token };
    }
    // Байхгүй и-мэйлд ч ижил хариу — акаунт байгаа эсэхийг мэдэгдэхгүй.
    return { ok: true };
  });

  route('POST', '/auth/reset-password', async (ctx) => {
    const body = await readJson(ctx.req);
    const token = assertText(body.token, 'token');
    const password = assertStrongPassword(body.password);
    const record = (db.passwordResetTokens || []).find((item) => item.token === token && !item.usedAt);
    if (!record || new Date(record.expiresAt).getTime() < Date.now()) throw httpError(422, 'invalid_reset_token', 'Reset token is invalid or expired.');
    const user = db.users.find((item) => item.id === record.userId);
    if (!user) throw httpError(404, 'user_not_found', 'User was not found.');
    user.passwordHash = hashPassword(password);
    record.usedAt = now();
    audit(user.id, 'reset_password', 'user', user.id);
    saveState(db);
    return { ok: true };
  });
  
  route('POST', '/me/roles/seller', async (ctx) => {
    const user = requireAuth(ctx);
    if (!hasRole(user, ROLES.SELLER)) {
      user.roles.push(ROLES.SELLER);
      audit(user.id, 'add_seller_role', 'user', user.id);
    }
    const session = issueAuthSession(user);
    setRefreshCookie(ctx, session.refreshToken);
    saveState(db);
    return authResponse(user, session);
  });
  
  route('GET', '/me', async (ctx) => {
    const user = requireAuth(ctx);
    return { user: publicUser(user), shop: hasRole(user, ROLES.SELLER) ? sellerShop(user.id) : null };
  });

  route('PATCH', '/me', async (ctx) => {
    const user = requireAuth(ctx);
    const body = await readJson(ctx.req);
    if (body.name !== undefined) user.name = assertText(body.name, 'name');
    if (body.phone !== undefined) user.phone = body.phone ? assertText(body.phone, 'phone') : null;
    if (body.locale !== undefined) user.locale = assertSupportedLocale(body.locale);
    if (body.country !== undefined) user.country = assertText(body.country, 'country');
    user.updatedAt = now();
    audit(user.id, 'update_profile', 'user', user.id);
    saveState(db);
    return { user: publicUser(user), shop: hasRole(user, ROLES.SELLER) ? sellerShop(user.id) : null };
  });
};
