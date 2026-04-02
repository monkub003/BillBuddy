/**
 * Firestore abstraction layer.
 * Provides both an in-memory store (for tests) and a real Firestore store.
 */
import * as admin from "firebase-admin";
export interface FirestoreStore<T> {
    get(id: string): Promise<T | undefined>;
    findBy(field: keyof T, value: unknown): Promise<T | undefined>;
    findAllBy(field: keyof T, value: unknown): Promise<T[]>;
    set(id: string, data: T): Promise<void>;
    delete(id: string): Promise<boolean>;
    getAll(): Promise<T[]>;
}
export declare function initFirebase(): admin.firestore.Firestore;
export declare function createFirestoreStore<T>(collectionName: string, db: admin.firestore.Firestore): FirestoreStore<T>;
export declare function createInMemoryStore<T>(): FirestoreStore<T>;
//# sourceMappingURL=firestore.d.ts.map