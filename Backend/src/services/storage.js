'use strict';

const fs = require('fs');
const path = require('path');
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

function createStorageService({ httpError }) {
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

  return { saveImage, saveThumbnail };
}

module.exports = { createStorageService };
