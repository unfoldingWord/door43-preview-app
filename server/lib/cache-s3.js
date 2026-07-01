// S3 cache backend (shared / durable). Same get/set surface as the disk backend.
//
// Credentials come from the standard AWS SDK provider chain — env vars
// (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION), instance role, etc. The
// app is agnostic to how they arrive; in prod puppet injects them (from openbao)
// into the app env. Config: AWS_S3_BUCKET (required to enable S3), AWS_REGION
// (default us-west-2), AWS_S3_PREFIX (default "preview-cache").
//
// Fail-soft: a get/set failure is logged and treated as a miss / no-op so caching
// problems never break a render request.
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const REGION = process.env.AWS_REGION || 'us-west-2';
const BUCKET = process.env.AWS_S3_BUCKET;
const PREFIX = (process.env.AWS_S3_PREFIX || 'preview-cache').replace(/\/+$/, '');

let _client = null;
function client() {
  if (!_client) _client = new S3Client({ region: REGION });
  return _client;
}

function objectKey(key, ext) {
  return `${PREFIX}/${key}.${ext}`;
}

const CONTENT_TYPES = {
  json: 'application/json',
  html: 'text/html; charset=utf-8',
  pdf: 'application/pdf',
};

function isNotFound(e) {
  return (
    e &&
    (e.name === 'NoSuchKey' ||
      e.name === 'NotFound' ||
      (e.$metadata && e.$metadata.httpStatusCode === 404))
  );
}

export async function getCached(key, { ext = 'html', binary = false } = {}) {
  try {
    const out = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: objectKey(key, ext) }));
    if (binary) return Buffer.from(await out.Body.transformToByteArray());
    return await out.Body.transformToString('utf-8');
  } catch (e) {
    if (isNotFound(e)) return null;
    console.error('[cache-s3] get failed for', objectKey(key, ext), '-', e.message);
    return null; // fail soft -> treated as a miss
  }
}

export async function setCached(key, data, { ext = 'html' } = {}) {
  try {
    await client().send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: objectKey(key, ext),
        Body: data,
        ContentType: CONTENT_TYPES[ext] || 'application/octet-stream',
      })
    );
  } catch (e) {
    console.error('[cache-s3] set failed for', objectKey(key, ext), '-', e.message);
    // fail soft -> not caching shouldn't break the request
  }
}
