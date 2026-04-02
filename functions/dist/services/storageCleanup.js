"use strict";
/**
 * Storage cleanup service.
 *
 * Provides a function that lists files under the `receipts/` path in
 * Firebase Storage and deletes any that are older than 24 hours.
 *
 * In production this would be wired to a Cloud Scheduler trigger.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldImages = cleanupOldImages;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
/**
 * Delete uploaded receipt images older than 24 hours.
 *
 * @param bucket - Firebase Storage bucket (or compatible mock)
 * @param prefix - Storage path prefix to scan (default `receipts/`)
 * @param maxAgeMs - Maximum file age in milliseconds (default 24 h)
 */
async function cleanupOldImages(bucket, prefix = "receipts/", maxAgeMs = TWENTY_FOUR_HOURS_MS) {
    const result = { deleted: [], errors: [] };
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "unknown error";
            result.errors.push(`${file.name}: ${message}`);
        }
    }
    return result;
}
//# sourceMappingURL=storageCleanup.js.map