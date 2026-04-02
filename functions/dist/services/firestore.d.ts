/**
 * Firestore abstraction layer.
 * Uses an in-memory Map for now — swap for real Firestore later.
 */
export interface FirestoreStore<T> {
    get(id: string): Promise<T | undefined>;
    findBy(field: keyof T, value: unknown): Promise<T | undefined>;
    findAllBy(field: keyof T, value: unknown): Promise<T[]>;
    set(id: string, data: T): Promise<void>;
    delete(id: string): Promise<boolean>;
    getAll(): Promise<T[]>;
}
export declare function createInMemoryStore<T>(): FirestoreStore<T>;
//# sourceMappingURL=firestore.d.ts.map