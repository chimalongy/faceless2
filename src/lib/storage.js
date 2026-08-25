import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let r2ClientInstance = null;

export function getR2Client() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  if (!r2ClientInstance) {
    r2ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      maxAttempts: 5,
    });
  }
  return r2ClientInstance;
}

export function getBucketName() {
  return process.env.CLOUDFLARE_R2_BUCKET_NAME || "faceless-media";
}

export function getPublicBaseUrl() {
  return (
    process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, "") ||
    ""
  );
}

/**
 * Upload a file Buffer directly to Cloudflare R2 with retry mechanism
 */
export async function uploadToR2({ key, buffer, mimeType, metadata = {} }, maxRetries = 3) {
  const client = getR2Client();
  if (!client) {
    throw new Error("Cloudflare R2 is not configured. Missing credentials.");
  }

  const bucket = getBucketName();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: metadata,
  });

  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await client.send(command);
      const publicBase = getPublicBaseUrl();
      const publicUrl = publicBase ? `${publicBase}/${key}` : `/${key}`;

      return {
        key,
        bucket,
        publicUrl,
      };
    } catch (err) {
      lastErr = err;
      const isNetworkError =
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.code === "EPIPE" ||
        err.name === "TimeoutError" ||
        err.message?.includes("ECONNRESET");

      if (isNetworkError && attempt < maxRetries) {
        console.warn(`[uploadToR2] Upload failed (${err.message}), retrying attempt ${attempt + 1}/${maxRetries}...`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      throw err;
    }
  }

  throw lastErr;
}

/**
 * Generate a presigned upload URL for direct browser-to-R2 upload (ideal for heavy videos)
 */
export async function getPresignedR2UploadUrl({ key, mimeType, expiresIn = 3600 }) {
  const client = getR2Client();
  if (!client) {
    throw new Error("Cloudflare R2 is not configured. Missing credentials.");
  }

  const bucket = getBucketName();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  const publicBase = getPublicBaseUrl();
  const publicUrl = publicBase ? `${publicBase}/${key}` : `/${key}`;

  return {
    uploadUrl,
    key,
    publicUrl,
  };
}

/**
 * Delete a single object from Cloudflare R2
 */
export async function deleteFromR2(key) {
  if (!key) return false;
  const client = getR2Client();
  if (!client) return false;

  try {
    const bucket = getBucketName();
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (err) {
    console.warn("Failed to delete object from Cloudflare R2:", key, err);
    return false;
  }
}

/**
 * Delete multiple objects in batch from Cloudflare R2
 */
export async function deleteMultipleFromR2(keys = []) {
  const validKeys = (keys || []).filter(Boolean);
  if (validKeys.length === 0) return true;

  const client = getR2Client();
  if (!client) return false;

  try {
    const bucket = getBucketName();
    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: validKeys.map((k) => ({ Key: k })),
        Quiet: true,
      },
    });

    await client.send(command);
    return true;
  } catch (err) {
    console.warn("Failed to batch delete objects from Cloudflare R2:", err);
    return false;
  }
}
