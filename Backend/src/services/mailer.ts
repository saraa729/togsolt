'use strict';

const logger = require('../observability/logger');

/**
 * Имэйл илгээгч.
 *
 * SMTP тохируулсан бол `nodemailer`-ээр илгээнэ. Тохируулаагүй (хөгжүүлэлт,
 * тест) үед илгээхийн оронд логт бичнэ — ингэснээр нууц үг сэргээх урсгал
 * SMTP-гүйгээр ч бүтнээр ажиллана.
 *
 * `nodemailer` нь сайн дурын хамаарал: байхгүй бол лог руу уначихна.
 */
function createMailer() {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM || 'ExpoCraft <no-reply@expocraft.mn>';
  let transport = null;

  if (host) {
    try {
      const nodemailer = require('nodemailer');
      transport = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || 'false') === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined
      });
    } catch (error) {
      logger.error('mail.transport_unavailable', { error: error.message });
    }
  }

  const enabled = Boolean(transport);

  async function send({ to, subject, text, html }) {
    if (!transport) {
      // Хөгжүүлэлтийн горим: агуулгыг логт үлдээнэ.
      logger.info('mail.skipped', { to, subject, preview: String(text || '').slice(0, 200) });
      return { delivered: false, reason: 'smtp_not_configured' };
    }
    try {
      await transport.sendMail({ from, to, subject, text, html });
      logger.info('mail.sent', { to, subject });
      return { delivered: true };
    } catch (error) {
      // Имэйл илгээж чадаагүй нь хэрэглэгчийн үйлдлийг унагаах ёсгүй.
      logger.error('mail.failed', { to, subject, error: error.message });
      return { delivered: false, reason: 'send_failed' };
    }
  }

  return { enabled, send };
}

module.exports = { createMailer };
