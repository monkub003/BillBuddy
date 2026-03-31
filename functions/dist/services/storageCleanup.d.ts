/**
 * Storage cleanup service.
 *
 * Provides a function that lists files under the `receipts/` path in
 * Firebase Storage and deletes any that are older than 24 hours.
 *
 * In production this would be wired to a Cloud Scheduler trigger.
 */
export interface StorageBucket {
    getFiles(options: {
        prefix: string;
    }): Promise<[StorageFile[]]>;
}
export interface StorageFile {
    name: string;
    getMetadata(): Promise<[{
        timeCreated: string;
    }]>;
    delete(): Promise<void>;
}
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
export declare function cleanupOldImages(bucket: StorageBucket, prefix?: string, maxAgeMs?: number): Promise<CleanupResult>;
//# sourceMappingURL=storageCleanup.d.ts.map