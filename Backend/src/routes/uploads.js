'use strict';

const ALLOWED_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif']
]);

function parseMultipart(buffer, contentType) {
  const boundary = contentType.match(/boundary=([^;]+)/)?.[1];
  if (!boundary) return null;
  const marker = Buffer.from(`--${boundary}`);
  const start = buffer.indexOf(marker);
  if (start < 0) return null;
  const headerStart = start + marker.length + 2;
  const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
  if (headerEnd < 0) return null;
  const headers = buffer.slice(headerStart, headerEnd).toString('utf8');
  const type = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim();
  const name = headers.match(/filename="([^"]+)"/i)?.[1]?.trim() || 'upload';
  const bodyStart = headerEnd + 4;
  const endMarker = Buffer.from(`\r\n--${boundary}`);
  const bodyEnd = buffer.indexOf(endMarker, bodyStart);
  if (bodyEnd < 0) return null;
  return { name, type, data: buffer.slice(bodyStart, bodyEnd) };
}

module.exports = function registerUploads(ctx) {
  const { route, ROLES, db, now, id, httpError, saveState, audit, readRaw, requireRole, saveImage, saveThumbnail } = ctx;

  route('POST', '/uploads/images', async (ctx) => {
    const user = requireRole(ctx, [ROLES.SELLER, ROLES.ADMIN]);
    const raw = await readRaw(ctx.req, 6 * 1024 * 1024);
    const contentType = String(ctx.req.headers['content-type'] || '');
    const parsed = parseMultipart(raw, contentType);
    if (!parsed || !ALLOWED_TYPES.has(parsed.type)) throw httpError(422, 'invalid_upload', 'Only jpg, png, webp, and gif images are supported.');
    const fileName = `${id('img')}${ALLOWED_TYPES.get(parsed.type)}`;
    const stored = await saveImage({ fileName, contentType: parsed.type, data: parsed.data });
    // Жагсаалтад хөнгөн хувилбар үзүүлэхийн тулд. Бүтэлгүйтвэл null — эх зураг үлдэнэ.
    const thumbnailUrl = await saveThumbnail({ fileName, contentType: parsed.type, data: parsed.data });
    const upload = {
      id: id('upl'),
      ownerId: user.id,
      provider: stored.provider,
      url: stored.url,
      thumbnailUrl,
      fileName: parsed.name,
      contentType: parsed.type,
      size: parsed.data.length,
      createdAt: now()
    };
    db.uploads = db.uploads || [];
    db.uploads.push(upload);
    audit(user.id, 'upload_image', 'upload', upload.id);
    saveState(db);
    return { upload };
  });
};
