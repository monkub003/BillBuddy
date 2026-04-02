/**
 * Storage cleanup service.
 *
 * Provides a function that lists files under the `receipts/` path in
 * Firebase Storage and deletes any that are older than 24 hours.
 *
 * In production this would be wired to a Cloud Scheduler trigger.
 */

export interface StorageBucket {
  getFiles(options: { prefix: string }): Promise<[StorageFile[]]>;
}

export interface StorageFile {
  name: string;
  getMetadata(): Promise<[{ timeCreated: string }]>;
  delete(): Promise<void>;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface CleanupResult {
  deleted: string[];
  errors: string[];
}

/**
 * Delete uploaded receipt images older than 24 hours.
 *
 * @param bucket - Firebase Storage bucket (or compatible mock)
 * @param prefix - Storage path prefix to scan (default `receipts/`)
 * @param maxAgeMs - Maximum file age in milliseconds (default 24 h)
 */
export async function cleanupOldImages(
  bucket: StorageBucket,
  prefix = "receipts/",
  maxAgeMs = TWENTY_FOUR_HOURS_MS
): Promise<CleanupResult> {
  const result: CleanupResult = { deleted: [], errors: [] };

  const [files] = await bucket.getFiles({ prefix });

  const now = Date.now();

  for (const file of files) {
    try {
      const [metadata] = await file.getMetadata();
      const createdAt = new Date(metadata.timeCreated).getTime();

      if (now - createdAt > maxAgeMs) {
        await file.delete();
        result.deleted.push(file.name);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "unknown error";
      result.errors.push(`${file.name}: ${message}`);
    }
  }

  return result;
}
