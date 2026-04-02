"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFirebase = initFirebase;
exports.createFirestoreStore = createFirestoreStore;
exports.createInMemoryStore = createInMemoryStore;
/**
 * Firestore abstraction layer.
 * Provides both an in-memory store (for tests) and a real Firestore store.
 */
const admin = __importStar(require("firebase-admin"));
let initialized = false;
function initFirebase() {
    if (!initialized) {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
            : undefined;
        const credential = privateKey && process.env.FIREBASE_CLIENT_EMAIL
            ? admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID || "billbuddy-return",
                privateKey,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            })
            : undefined;
        admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || "billbuddy-return",
            ...(credential ? { credential } : {}),
        });
        initialized = true;
    }
    return admin.firestore();
}
function createFirestoreStore(collectionName, db) {
    const collection = db.collection(collectionName);
    return {
        async get(id) {
            const doc = await collection.doc(id).get();
            return doc.exists ? doc.data() : undefined;
        },
        async findBy(field, value) {
            const snap = await collection.where(field, "==", value).limit(1).get();
            return snap.empty ? undefined : snap.docs[0].data();
        },
        async findAllBy(field, value) {
            const snap = await collection.where(field, "==", value).get();
            return snap.docs.map((d) => d.data());
        },
        async set(id, data) {
            // Strip undefined values — Firestore rejects them
            const cleaned = JSON.parse(JSON.stringify(data));
            await collection.doc(id).set(cleaned);
        },
        async delete(id) {
            const doc = await collection.doc(id).get();
            if (!doc.exists)
                return false;
            await collection.doc(id).delete();
            return true;
        },
        async getAll() {
            const snap = await collection.get();
            return snap.docs.map((d) => d.data());
        },
    };
}
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