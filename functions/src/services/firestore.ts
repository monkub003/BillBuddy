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
