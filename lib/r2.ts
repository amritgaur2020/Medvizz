/**
 * lib/r2.ts
 *
 * Cloudflare R2 client using the AWS S3-compatible API.
 * R2 is fully S3-compatible, so we use @aws-sdk/client-s3.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_ACCESS_KEY_ID    — R2 API token Access Key ID
 *   R2_SECRET_ACCESS_KEY — R2 API token Secret Access Key
 *   R2_BUCKET_NAME      — R2 bucket name (e.g. "medvizz")
 *   R2_PUBLIC_URL       — Public bucket URL (optional, defaults to local proxy route)
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

// ─── Lazy singleton ───────────────────────────────────────────────────────────
let _client: S3Client | null = null;

function getR2Client(): S3Client {
  if (_client) return _client;

  const accountId = process.env.R2_ACCOUNT_ID || 'fc9548bb9784353fa16a15e88fc31789';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 credentials not configured. Please set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in .env.local'
    );
  }

  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return _client;
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME || 'medvizz';
  return bucket;
}

/** Returns the public URL or local proxy URL for a stored object key */
export function getR2PublicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
  
  // If there is no custom domain, or it remains a placeholder, fall back to our local Next.js proxy route
  if (!base || base.includes('pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev')) {
    return `/api/r2-file?key=${encodeURIComponent(key)}`;
  }
  return `${base}/${key}`;
}

// ─── Upload helpers ───────────────────────────────────────────────────────────

/**
 * Upload a GLB model buffer to R2.
 * Key format: models/<modelId>.glb
 */
export async function uploadModelToR2(
  modelId: string,
  buffer: ArrayBuffer,
  contentType = 'model/gltf-binary'
): Promise<string> {
  const client = getR2Client();
  const bucket = getBucketName();
  const key = `models/${modelId}.glb`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  console.log(`[R2] Uploaded GLB → ${key} (${buffer.byteLength} bytes)`);
  return getR2PublicUrl(key);
}

/**
 * Upload a preview image (PNG/JPEG) to R2.
 * Key format: previews/<modelId>.<ext>
 */
export async function uploadPreviewToR2(
  modelId: string,
  buffer: ArrayBuffer,
  contentType = 'image/png'
): Promise<string> {
  const client = getR2Client();
  const bucket = getBucketName();
  const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
  const key = `previews/${modelId}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  console.log(`[R2] Uploaded preview → ${key} (${buffer.byteLength} bytes)`);
  return getR2PublicUrl(key);
}

/**
 * Upload model metadata to R2 as a JSON file.
 * Key format: metadata/<modelId>.json
 */
export async function uploadMetadataToR2(
  modelId: string,
  metadata: any
): Promise<void> {
  try {
    const client = getR2Client();
    const bucket = getBucketName();
    const key = `metadata/${modelId}.json`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(metadata, null, 2),
        ContentType: 'application/json',
        CacheControl: 'no-cache, no-store, must-revalidate',
      })
    );

    console.log(`[R2] Uploaded metadata → ${key}`);
  } catch (err) {
    console.error('[R2] Error uploading metadata:', err);
  }
}

/**
 * Retrieve model metadata from R2.
 */
export async function getMetadataFromR2(modelId: string): Promise<any | null> {
  try {
    const client = getR2Client();
    const bucket = getBucketName();
    const key = `metadata/${modelId}.json`;

    const res = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (res.Body) {
      const bytes = await res.Body.transformToByteArray();
      const text = new TextDecoder().decode(bytes);
      return JSON.parse(text);
    }
    return null;
  } catch {
    // If metadata file doesn't exist or errors out, return null
    return null;
  }
}

/**
 * Retrieve a file stream/bytes from R2 directly for streaming.
 */
export async function getFileFromR2(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const client = getR2Client();
    const bucket = getBucketName();

    const res = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (res.Body) {
      const bytes = await res.Body.transformToByteArray();
      const contentType = res.ContentType || 'application/octet-stream';
      return { bytes, contentType };
    }
    return null;
  } catch (err) {
    console.error(`[R2] Error downloading file ${key}:`, err);
    return null;
  }
}

/**
 * Delete a model, its preview, and its metadata from R2 by modelId.
 */
export async function deleteModelFromR2(modelId: string): Promise<void> {
  const client = getR2Client();
  const bucket = getBucketName();

  const keys = [
    `models/${modelId}.glb`,
    `previews/${modelId}.png`,
    `previews/${modelId}.jpg`,
    `metadata/${modelId}.json`,
  ];

  await Promise.allSettled(
    keys.map((key) =>
      client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    )
  );

  console.log(`[R2] Deleted model assets & metadata for: ${modelId}`);
}

/**
 * Check if a key already exists in R2 (to avoid re-uploading).
 */
export async function r2KeyExists(key: string): Promise<boolean> {
  try {
    const client = getR2Client();
    const bucket = getBucketName();
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * List all model objects in R2 (under the models/ prefix).
 */
export async function listR2Models(): Promise<{ key: string; size: number; lastModified: Date }[]> {
  const client = getR2Client();
  const bucket = getBucketName();

  const res = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: 'models/' })
  );

  return (res.Contents || []).map((obj) => ({
    key: obj.Key || '',
    size: obj.Size || 0,
    lastModified: obj.LastModified || new Date(),
  }));
}

/**
 * Lists all 3D models stored in R2, populated with their JSON metadata if available.
 */
export async function listR2ModelsWithMetadata(): Promise<any[]> {
  try {
    const objects = await listR2Models();
    
    const models = await Promise.all(
      objects.map(async (obj) => {
        const key = obj.key || '';
        const filename = key.split('/').pop() || '';
        const modelId = filename.replace('.glb', '');

        // Fetch corresponding metadata JSON
        const meta = await getMetadataFromR2(modelId);

        return {
          id: modelId,
          topic: meta?.topic || modelId,
          prompt: meta?.prompt || `3D model generated for ${modelId}`,
          model_url: getR2PublicUrl(key),
          image_url: meta?.image_url || getR2PublicUrl(`previews/${modelId}.png`),
          title: meta?.title || meta?.topic || modelId,
          user_id: meta?.user_id || 'user_default',
          created_at: meta?.created_at || obj.lastModified.toISOString(),
          size: obj.size,
        };
      })
    );

    // Sort models by creation date descending
    return models.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (err) {
    console.error('[R2] Error in listR2ModelsWithMetadata:', err);
    return [];
  }
}

/**
 * Upload a generic JSON object to R2.
 */
export async function uploadJsonToR2(key: string, data: any): Promise<void> {
  try {
    const client = getR2Client();
    const bucket = getBucketName();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json',
        CacheControl: 'no-cache, no-store, must-revalidate',
      })
    );
    console.log(`[R2] Uploaded JSON → ${key}`);
  } catch (err) {
    console.error(`[R2] Failed to upload JSON to ${key}:`, err);
  }
}

/**
 * Retrieve a generic JSON object from R2.
 */
export async function getJsonFromR2(key: string): Promise<any | null> {
  try {
    const client = getR2Client();
    const bucket = getBucketName();

    const res = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (res.Body) {
      const bytes = await res.Body.transformToByteArray();
      const text = new TextDecoder().decode(bytes);
      return JSON.parse(text);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Delete a JSON object from R2.
 */
export async function deleteJsonFromR2(key: string): Promise<void> {
  try {
    const client = getR2Client();
    const bucket = getBucketName();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`[R2] Deleted JSON → ${key}`);
  } catch (err) {
    console.error(`[R2] Failed to delete JSON ${key}:`, err);
  }
}

