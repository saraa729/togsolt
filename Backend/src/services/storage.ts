'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { UPLOAD_DIR } = require('../config/constants');

/**
 * `sharp` байгаа бол thumbnail үүсгэнэ. Сайн дурын хамаарал болгосон шалтгаан:
 * зарим орчинд эх кодоо суулгахад `sharp` бүтэлгүйтдэг тул түүнээс болж зураг
 * байршуулах үндсэн үйлдэл унах ёсгүй.
 */
function loadSharp() {
  try {
    return require('sharp');
  } catch {
    return null;
  }
}

const THUMB_WIDTH = 400;

function sha256Hex(value: string | Buffer) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function awsDate(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function encodePathPart(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function putS3Object({ fileName, contentType, data, httpError }) {
  const endpoint = String(process.env.EXPOCRAFT_S3_ENDPOINT || process.env.EXPOCRAFT_R2_ENDPOINT || '').replace(/\/$/, '');
  const bucket = String(process.env.EXPOCRAFT_S3_BUCKET || process.env.EXPOCRAFT_R2_BUCKET || '').trim();
  const region = String(process.env.EXPOCRAFT_S3_REGION || process.env.EXPOCRAFT_R2_REGION || 'auto').trim();
  const accessKeyId = String(process.env.EXPOCRAFT_S3_ACCESS_KEY_ID || process.env.EXPOCRAFT_R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.EXPOCRAFT_S3_SECRET_ACCESS_KEY || process.env.EXPOCRAFT_R2_SECRET_ACCESS_KEY || '').trim();
  const publicBaseUrl = String(process.env.EXPOCRAFT_STORAGE_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    throw httpError(500, 'storage_not_configured', 'S3/R2 storage provider is not configured.');
  }

  const url = new URL(endpoint);
  const objectKey = fileName.split('/').map(encodePathPart).join('/');
  const canonicalUri = `/${bucket}/${objectKey}`;
  const uploadUrl = `${url.origin}${canonicalUri}`;
  const payloadHash = sha256Hex(data);
  const { amzDate, dateStamp } = awsDate();
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join('\n') + '\n';
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      authorization,
      'content-type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    },
    body: data
  });
  if (!response.ok) throw httpError(502, 'storage_upload_failed', 'S3/R2 storage upload failed.');
  return {
    provider: String(process.env.EXPOCRAFT_STORAGE_PROVIDER || 's3').toLowerCase(),
    url: `${publicBaseUrl}/${objectKey}`
  };
}

function createStorageService({ httpError }) {
  async function scanFile({ fileName, contentType, data }) {
    const scanUrl = String(process.env.EXPOCRAFT_VIRUS_SCAN_URL || '').trim();
    const required = String(process.env.EXPOCRAFT_VIRUS_SCAN_REQUIRED || '').toLowerCase() === 'true';
    if (!scanUrl) {
      if (required) throw httpError(500, 'virus_scan_not_configured', 'Virus scanning is required but not configured.');
      return { status: 'skipped', clean: true };
    }
    const response = await fetch(scanUrl, {
      method: 'POST',
      headers: {
        'content-type': contentType,
        'x-file-name': fileName,
        ...(process.env.EXPOCRAFT_VIRUS_SCAN_TOKEN ? { authorization: `Bearer ${process.env.EXPOCRAFT_VIRUS_SCAN_TOKEN}` } : {})
      },
      body: data
    });
    if (!response.ok) {
      if (required) throw httpError(502, 'virus_scan_failed', 'Virus scan failed.');
      return { status: 'unavailable', clean: true };
    }
    const payload = await response.json().catch(() => ({}));
    if (payload.clean === false || payload.status === 'infected') throw httpError(422, 'malware_detected', 'Uploaded file failed virus scan.');
    return { status: payload.status || 'clean', clean: true, scannerRef: payload.id || payload.ref || null };
  }

  /**
   * Жагсаалтын хуудсанд эх зураг (ихэвчлэн 1-3MB) татах шаардлагагүй тул
   * 400px өргөнтэй хувилбар үүсгэнэ. Нэр нь `<файл>_thumb.<өргөтгөл>`.
   */
  async function saveThumbnail({ fileName, contentType, data }) {
    const sharp = loadSharp();
    if (!sharp) return null;
    const dot = fileName.lastIndexOf('.');
    const thumbName = dot === -1 ? `${fileName}_thumb` : `${fileName.slice(0, dot)}_thumb${fileName.slice(dot)}`;
    try {
      const resized = await sharp(data).resize({ width: THUMB_WIDTH, withoutEnlargement: true }).toBuffer();
      const stored = await saveImage({ fileName: thumbName, contentType, data: resized });
      return stored.url;
    } catch {
      // Thumbnail бол нэмэлт боломж — бүтэлгүйтвэл эх зураг хэвээр үйлчилнэ.
      return null;
    }
  }

  async function saveImage({ fileName, contentType, data }) {
    const provider = String(process.env.EXPOCRAFT_STORAGE_PROVIDER || 'local').toLowerCase();
    if (provider === 's3' || provider === 'r2') {
      return putS3Object({ fileName, contentType, data, httpError });
    }
    if (provider === 'http' || provider === 'cloudinary') {
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

  return { saveImage, saveThumbnail, scanFile };
}

module.exports = { createStorageService };
