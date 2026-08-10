'use strict';

const crypto = require('crypto');

function createAuthContext({ db, audit, id, now, httpError, signToken, verifyToken }) {
  function publicUser(user) {
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return safe;
  }

  function requireAuth(ctx) {
    const auth = ctx.req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = verifyToken(token);
    const user = db.users.find((item) => item.id === payload.sub);
    if (!user) throw httpError(401, 'user_not_found', 'Authenticated user was not found.');
    ctx.user = user;
    return user;
  }

  function requireRole(ctx, roles) {
    const user = requireAuth(ctx);
    const allowed = Array.isArray(roles) ? roles : [roles];
    const userRoles = user.roles || [user.role];
    if (!allowed.some((role) => userRoles.includes(role))) throw httpError(403, 'forbidden', 'You do not have permission for this action.');
    return user;
  }

  function hasRole(user, role) {
    return (user.roles || [user.role]).includes(role);
  }

  function issueAuthSession(user, replacedTokenId = null) {
    const tokenId = id('rt');
    const refreshToken = `${tokenId}.${crypto.randomBytes(32).toString('base64url')}`;
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = {
      id: tokenId,
      userId: user.id,
      tokenHash,
      replacedTokenId,
      revokedAt: null,
      createdAt: now(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    };
    db.refreshTokens.push(session);
    const accessToken = signToken({ sub: user.id, roles: user.roles || [user.role] });
    return { accessToken, refreshToken, session };
  }

  function rotateRefreshToken(refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(String(refreshToken || '')).digest('hex');
    const session = db.refreshTokens.find((item) => item.tokenHash === tokenHash);
    if (!session || session.revokedAt) throw httpError(401, 'invalid_refresh_token', 'Invalid refresh token.');
    if (new Date(session.expiresAt).getTime() < Date.now()) throw httpError(401, 'refresh_token_expired', 'Refresh token expired.');
    const user = db.users.find((item) => item.id === session.userId);
    if (!user) throw httpError(401, 'user_not_found', 'Refresh token user was not found.');
    session.revokedAt = now();
    const next = issueAuthSession(user, session.id);
    audit(user.id, 'refresh_token_rotate', 'refresh_token', session.id, { nextTokenId: next.session.id });
    return { user, ...next };
  }

  function revokeRefreshToken(refreshToken, actorId) {
    const tokenHash = crypto.createHash('sha256').update(String(refreshToken || '')).digest('hex');
    const session = db.refreshTokens.find((item) => item.tokenHash === tokenHash);
    if (session && !session.revokedAt) {
      session.revokedAt = now();
      audit(actorId || session.userId, 'refresh_token_revoke', 'refresh_token', session.id);
    }
  }

  return {
    publicUser,
    requireAuth,
    requireRole,
    hasRole,
    issueAuthSession,
    rotateRefreshToken,
    revokeRefreshToken
  };
}

module.exports = { createAuthContext };
