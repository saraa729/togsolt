'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { httpError } = require('../utils/core');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), candidate);
}

function signToken(payload) {
  try {
    return jwt.sign({ ...payload }, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '15m'
    });
  } catch (error) {
    throw httpError(500, 'token_sign_failed', 'Failed to sign auth token.');
  }
}

function verifyToken(token) {
  if (!token) throw httpError(401, 'invalid_token', 'Invalid auth token.');
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw httpError(401, 'token_expired', 'Access token expired.');
    }
    throw httpError(401, 'invalid_token', 'Invalid auth token.');
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken
};
