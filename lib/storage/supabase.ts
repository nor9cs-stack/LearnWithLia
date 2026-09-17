import "server-only";

import { createClient } from "@supabase/supabase-js";
import { APP_CONFIG } from "@/lib/config";

function storageConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "exam-source-files";
  if (!url || !serviceRoleKey) throw new Error("STORAGE_NOT_CONFIGURED");
  return { url, serviceRoleKey, bucket };
}

let privateBucketVerification: Promise<void> | undefined;

async function ensurePrivateBucket() {
  if (privateBucketVerification) return privateBucketVerification;
  privateBucketVerification = (async () => {
    const { bucket } = storageConfig();
    const { data, error } = await getStorageAdmin().storage.getBucket(bucket);
    if (error) throw new Error(`STORAGE_BUCKET_CHECK_FAILED:${error.message}`);
    if (data.public) throw new Error("STORAGE_BUCKET_MUST_BE_PRIVATE");
  })();
  try {
    await privateBucketVerification;
  } catch (error) {
    privateBucketVerification = undefined;
    throw error;
  }
}

export function getStorageAdmin() {
  const { url, serviceRoleKey } = storageConfig();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function uploadPrivateExamFile(path: string, bytes: Uint8Array, contentType: string) {
  const { bucket } = storageConfig();
  await ensurePrivateBucket();
  const { error } = await getStorageAdmin().storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: false,
    cacheControl: "private, max-age=0, no-store",
  });
  if (error) throw new Error(`STORAGE_UPLOAD_FAILED:${error.message}`);
}

export async function downloadPrivateFile(path: string) {
  const { bucket } = storageConfig();
  await ensurePrivateBucket();
  const { data, error } = await getStorageAdmin().storage.from(bucket).download(path);
  if (error) throw new Error(`STORAGE_DOWNLOAD_FAILED:${error.message}`);
  return new Uint8Array(await data.arrayBuffer());
}

export async function deletePrivateFile(path: string) {
  const { bucket } = storageConfig();
  await ensurePrivateBucket();
  const { error } = await getStorageAdmin().storage.from(bucket).remove([path]);
  if (error) throw new Error(`STORAGE_DELETE_FAILED:${error.message}`);
}

export async function createExamFileSignedUrl(path: string) {
  const { bucket } = storageConfig();
  await ensurePrivateBucket();
  const { data, error } = await getStorageAdmin()
    .storage
    .from(bucket)
    .createSignedUrl(path, APP_CONFIG.upload.signedUrlTtlSeconds);
  if (error) throw new Error(`STORAGE_SIGN_FAILED:${error.message}`);
  return data.signedUrl;
}
