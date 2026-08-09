'use strict';

const fs = require('fs');
const path = require('path');
const { UPLOAD_DIR } = require('../config/constants');

function createStorageService({ httpError }) {
  async function saveImage({ fileName, contentType, data }) {
    const provider = String(process.env.EXPOCRAFT_STORAGE_PROVIDER || 'local').toLowerCase();
    if (provider === 's3' || provider === 'r2' || provider === 'cloudinary') {
      if (!process.env.EXPOCRAFT_STORAGE_UPLOAD_URL || !process.env.EXPOCRAFT_STORAGE_PUBLIC_BASE_URL) {
        throw httpError(500, 'storage_not_configured', 'Remote storage provider is not configured.');
      }
      const uploadUrl = `${process.env.EXPOCRAFT_STORAGE_UPLOAD_URL.replace(/\/$/, '')}/${fileName}`;
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'content-type': contentType,
          ...(process.env.EXPOCRAFT_STORAGE_TOKEN ? { authorization: `Bearer ${process.env.EXPOCRAFT_STORAGE_TOKEN}` } : {})
        },
        body: data
      });
      if (!response.ok) throw httpError(502, 'storage_upload_failed', 'Remote storage upload failed.');
      return {
        provider,
        url: `${process.env.EXPOCRAFT_STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '')}/${fileName}`
      };
    }
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, fileName), data);
    return { provider: 'local', url: `/uploads/${fileName}` };
  }

  return { saveImage };
}

module.exports = { createStorageService };
