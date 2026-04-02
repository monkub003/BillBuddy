"use strict";
/**
 * Firestore abstraction layer.
 * Uses an in-memory Map for now — swap for real Firestore later.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInMemoryStore = createInMemoryStore;
function createInMemoryStore() {
    const store = new Map();
    return {
        async get(id) {
            return store.get(id);
        },
        async findBy(field, value) {
            for (const item of store.values()) {
                if (item[field] === value)
                    return item;
            }
            return undefined;
        },
        async findAllBy(field, value) {
            const results = [];
            for (const item of store.values()) {
                if (item[field] === value)
                    results.push(item);
            }
            return results;
        },
        async set(id, data) {
            store.set(id, data);
        },
        async delete(id) {
            return store.delete(id);
        },
        async getAll() {
            return Array.from(store.values());
        },
    };
}
//# sourceMappingURL=firestore.js.map