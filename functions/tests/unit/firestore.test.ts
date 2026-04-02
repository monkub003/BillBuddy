import { createInMemoryStore } from "../../src/services/firestore";

interface TestRecord {
  userId: string;
  category: string;
  amount: number;
}

describe("createInMemoryStore", () => {
  describe("findAllBy", () => {
    it("returns all records matching the field/value pair", async () => {
      const store = createInMemoryStore<TestRecord>();
      await store.set("1", { userId: "u1", category: "electricity", amount: 100 });
      await store.set("2", { userId: "u1", category: "water", amount: 50 });
      await store.set("3", { userId: "u2", category: "electricity", amount: 200 });
      await store.set("4", { userId: "u1", category: "gas", amount: 75 });

      const results = await store.findAllBy("userId", "u1");
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.userId === "u1")).toBe(true);
    });

    it("returns empty array when no records match", async () => {
      const store = createInMemoryStore<TestRecord>();
      await store.set("1", { userId: "u1", category: "electricity", amount: 100 });

      const results = await store.findAllBy("userId", "u999");
      expect(results).toEqual([]);
    });

    it("returns empty array on an empty store", async () => {
      const store = createInMemoryStore<TestRecord>();

      const results = await store.findAllBy("userId", "u1");
      expect(results).toEqual([]);
    });

    it("works with different field types", async () => {
      const store = createInMemoryStore<TestRecord>();
      await store.set("1", { userId: "u1", category: "electricity", amount: 100 });
      await store.set("2", { userId: "u2", category: "electricity", amount: 100 });
      await store.set("3", { userId: "u1", category: "water", amount: 200 });

      const byCategory = await store.findAllBy("category", "electricity");
      expect(byCategory).toHaveLength(2);

      const byAmount = await store.findAllBy("amount", 100);
      expect(byAmount).toHaveLength(2);
    });
  });

  describe("findBy (existing - returns first match only)", () => {
    it("returns only the first matching record", async () => {
      const store = createInMemoryStore<TestRecord>();
      await store.set("1", { userId: "u1", category: "electricity", amount: 100 });
      await store.set("2", { userId: "u1", category: "water", amount: 50 });

      const result = await store.findBy("userId", "u1");
      expect(result).toBeDefined();
      expect(result!.userId).toBe("u1");
    });
  });
});
