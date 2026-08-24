/**
 * Product image storage (Cloudflare R2).
 *
 * The rule this file exists to enforce: **an image byte never sits in a
 * database row.** The admin form sends a photo as base64 inside a JSON body —
 * the same transport the quote-request logo upload already uses — but what
 * lands in Postgres is a URL, never the bytes themselves. Those go to R2,
 * addressed by a content-derived key so two uploads of the same photo do not
 * collide and a stale one is never served under a fresh name.
 *
 * R2 exposes the S3 API, so this signs requests with AWS Signature Version 4
 * over plain `fetch` rather than pulling in an SDK — the same "no dependency
 * for one HTTP call" choice this codebase already made for Paystack, Resend
 * and the AliExpress adapter (see payments.ts, notifications.ts).
 *
 * When R2 is not configured, uploads refuse with a clear, honest error rather
 * than pretending to store the image — the same pattern `ManualTransferProvider`
 * uses for payments and the AI provider uses for brand generation.
 */

import { createHash, createHmac, randomUUID } from "node:crypto";

import { BrandoraError, ValidationError } from "@brandora/shared";
import {
  r2AccessKeyId,
  r2AccountId,
  r2BucketName,
  r2Configured,
  r2PublicUrl,
  r2SecretAccessKey,
} from "@brandora/config";

export class StorageNotConfiguredError extends BrandoraError {
  constructor() {
    super(
      "storage.not-configured",
      "Image storage is not set up yet — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_URL in the deployment environment.",
      501,
    );
    this.name = "StorageNotConfiguredError";
  }
}

/** Formats matched against the bytes, not the filename — see validateImage(). */
const MAGIC_BYTES: { contentType: string; extension: string; matches: (buf: Buffer) => boolean }[] = [
  { contentType: "image/jpeg", extension: "jpg", matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    contentType: "image/png",
    extension: "png",
    matches: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    contentType: "image/webp",
    extension: "webp",
    matches: (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  },
];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Identify an image by its actual bytes, never by a client-supplied filename
 * or Content-Type header — either is just a string an attacker chooses.
 * Throws the same customer-safe validation error the rest of the API uses.
 */
export function validateImage(buffer: Buffer): { contentType: string; extension: string } {
  if (buffer.length === 0) throw new ValidationError("image", "the file is empty");
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ValidationError("image", `must be at most ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB`);
  }
  const format = MAGIC_BYTES.find((f) => f.matches(buffer));
  if (!format) throw new ValidationError("image", "must be a JPG, PNG or WEBP file");
  return { contentType: format.contentType, extension: format.extension };
}

export interface UploadedImage {
  url: string;
  key: string;
}

export interface ImageStorage {
  readonly configured: boolean;
  upload(input: { productId: string; buffer: Buffer }): Promise<UploadedImage>;
  /** Takes the full public URL back apart to find the key; a no-op if it never lived here. */
  remove(url: string): Promise<void>;
}

/* --- AWS Signature Version 4, the part R2 shares with S3 ------------------ */

const hash = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string): Buffer => createHmac("sha256", key).update(data).digest();

function signingKey(secret: string, date: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

/** Signs one S3-compatible request. Region is "auto" — R2 does not use AWS regions. */
function signRequest(input: {
  method: "PUT" | "DELETE";
  accountId: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  body?: Buffer;
  contentType?: string;
}): SignedRequest {
  const region = "auto";
  const service = "s3";
  const host = `${input.accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = input.body ? hash(input.body) : hash("");

  // R2 object keys can contain characters (like the id's own separators) that
  // must be percent-encoded per component, but not the path's forward slashes.
  const canonicalUri = `/${input.bucket}/${input.key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (input.contentType) headers["content-type"] = input.contentType;

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join("");
  const signedHeaders = signedHeaderNames.join(";");

  const canonicalRequest = [
    input.method,
    canonicalUri,
    "", // no query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hash(canonicalRequest)].join("\n");

  const key = signingKey(input.secretAccessKey, dateStamp, region, service);
  const signature = hmac(key, stringToSign).toString("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${host}${canonicalUri}`,
    headers: { ...headers, Authorization: authorization },
  };
}

/** The real thing, talking to Cloudflare R2. */
export function r2Storage(env: Record<string, string | undefined> = process.env): ImageStorage {
  const configured = r2Configured(env);

  return {
    configured,

    async upload({ productId, buffer }) {
      if (!configured) throw new StorageNotConfiguredError();
      const { contentType, extension } = validateImage(buffer);

      const accountId = r2AccountId(env);
      const bucket = r2BucketName(env);
      const accessKeyId = r2AccessKeyId(env);
      const secretAccessKey = r2SecretAccessKey(env);
      const publicUrl = r2PublicUrl(env);

      // Content-derived-ish key: random rather than a hash of the bytes, so
      // re-uploading the same photo for a second product does not silently
      // reuse the first product's object. Namespaced under the product so an
      // admin looking at the bucket can tell whose photo is whose.
      const key = `products/${productId}/${randomUUID().replace(/-/g, "")}.${extension}`;

      const signed = signRequest({
        method: "PUT",
        accountId,
        bucket,
        key,
        accessKeyId,
        secretAccessKey,
        body: buffer,
        contentType,
      });

      // A fresh Uint8Array view: Node's Buffer type and the DOM fetch types'
      // BodyInit disagree on the ArrayBuffer generic even though the bytes are
      // identical at runtime.
      const response = await fetch(signed.url, {
        method: "PUT",
        headers: signed.headers,
        body: new Uint8Array(buffer),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new BrandoraError(
          "storage.upload-failed",
          `R2 rejected the upload (${response.status}): ${detail.slice(0, 300)}`,
          502,
        );
      }

      return { url: `${publicUrl}/${key}`, key };
    },

    async remove(url) {
      if (!configured) return;
      const publicUrl = r2PublicUrl(env);
      if (!url.startsWith(`${publicUrl}/`)) return; // not one of ours (or already gone)
      const key = url.slice(publicUrl.length + 1);

      const signed = signRequest({
        method: "DELETE",
        accountId: r2AccountId(env),
        bucket: r2BucketName(env),
        key,
        accessKeyId: r2AccessKeyId(env),
        secretAccessKey: r2SecretAccessKey(env),
      });

      const response = await fetch(signed.url, { method: "DELETE", headers: signed.headers });
      // 404 means it is already gone, which is the state remove() was asked
      // to reach — not a failure to report.
      if (!response.ok && response.status !== 404) {
        const detail = await response.text().catch(() => "");
        throw new BrandoraError(
          "storage.delete-failed",
          `R2 rejected the delete (${response.status}): ${detail.slice(0, 300)}`,
          502,
        );
      }
    },
  };
}

/** A test double: keeps bytes in memory, same interface, no network. */
export function memoryStorage(): ImageStorage & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  const publicUrl = "https://memory.test/bucket";
  return {
    configured: true,
    files,
    async upload({ productId, buffer }) {
      const { extension } = validateImage(buffer);
      const key = `products/${productId}/${randomUUID().replace(/-/g, "")}.${extension}`;
      files.set(key, buffer);
      return { url: `${publicUrl}/${key}`, key };
    },
    async remove(url) {
      if (!url.startsWith(`${publicUrl}/`)) return;
      files.delete(url.slice(publicUrl.length + 1));
    },
  };
}
