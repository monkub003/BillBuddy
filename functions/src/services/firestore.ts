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

let initialized = false;
export function initFirebase(): admin.firestore.Firestore {
  if (!initialized) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "billbuddy-dev",
    });
    initialized = true;
  }
  return admin.firestore();
}

export function createFirestoreStore<T>(
  collectionName: string,
  db: admin.firestore.Firestore
): FirestoreStore<T> {
  const collection = db.collection(collectionName);
  return {
    async get(id: string) {
      const doc = await collection.doc(id).get();
      return doc.exists ? (doc.data() as T) : undefined;
    },
    async findBy(field: keyof T, value: unknown) {
      const snap = await collection.where(field as string, "==", value).limit(1).get();
      return snap.empty ? undefined : (snap.docs[0].data() as T);
    },
    async findAllBy(field: keyof T, value: unknown) {
      const snap = await collection.where(field as string, "==", value).get();
      return snap.docs.map((d) => d.data() as T);
    },
    async set(id: string, data: T) {
      await collection.doc(id).set(data as admin.firestore.DocumentData);
    },
    async delete(id: string) {
      const doc = await collection.doc(id).get();
      if (!doc.exists) return false;
      await collection.doc(id).delete();
      return true;
    },
    async getAll() {
      const snap = await collection.get();
      return snap.docs.map((d) => d.data() as T);
    },
  };
}

export function createInMemoryStore<T>(): FirestoreStore<T> {
  const store = new Map<string, T>();
  return {
    async get(id: string) {
      return store.get(id);
    },
    async findBy(field: keyof T, value: unknown) {
      for (const item of store.values()) {
        if (item[field] === value) return item;
      }
      return undefined;
    },
    async findAllBy(field: keyof T, value: unknown) {
      const results: T[] = [];
      for (const item of store.values()) {
        if (item[field] === value) results.push(item);
      }
      return results;
    },
    async set(id: string, data: T) {
      store.set(id, data);
    },
    async delete(id: string) {
      return store.delete(id);
    },
    async getAll() {
      return Array.from(store.values());
    },
  };
}
