import {
  cleanupOldImages,
  StorageBucket,
  StorageFile,
} from "../../src/services/storageCleanup";

function createMockFile(name: string, ageMs: number): StorageFile {
  const createdAt = new Date(Date.now() - ageMs).toISOString();
  return {
    name,
    getMetadata: jest.fn().mockResolvedValue([{ timeCreated: createdAt }]),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockBucket(files: StorageFile[]): StorageBucket {
  return {
    getFiles: jest.fn().mockResolvedValue([files]),
  };
}

const ONE_HOUR = 60 * 60 * 1000;
const TWENTY_FIVE_HOURS = 25 * ONE_HOUR;
const TWENTY_THREE_HOURS = 23 * ONE_HOUR;

describe("cleanupOldImages", () => {
  it("deletes files older than 24 hours", async () => {
    const oldFile = createMockFile("receipts/user1/old.jpg", TWENTY_FIVE_HOURS);
    const bucket = createMockBucket([oldFile]);

    const result = await cleanupOldImages(bucket);

    expect(oldFile.delete).toHaveBeenCalled();
    expect(result.deleted).toEqual(["receipts/user1/old.jpg"]);
    expect(result.errors).toEqual([]);
  });

  it("keeps files younger than 24 hours", async () => {
    const newFile = createMockFile("receipts/user1/new.jpg", TWENTY_THREE_HOURS);
    const bucket = createMockBucket([newFile]);

    const result = await cleanupOldImages(bucket);

    expect(newFile.delete).not.toHaveBeenCalled();
    expect(result.deleted).toEqual([]);
  });

  it("handles a mix of old and new files", async () => {
    const oldFile = createMockFile("receipts/u1/old.jpg", TWENTY_FIVE_HOURS);
    const newFile = createMockFile("receipts/u2/new.jpg", TWENTY_THREE_HOURS);
    const bucket = createMockBucket([oldFile, newFile]);

    const result = await cleanupOldImages(bucket);

    expect(result.deleted).toEqual(["receipts/u1/old.jpg"]);
    expect(oldFile.delete).toHaveBeenCalled();
    expect(newFile.delete).not.toHaveBeenCalled();
  });

  it("handles empty bucket", async () => {
    const bucket = createMockBucket([]);
    const result = await cleanupOldImages(bucket);
    expect(result.deleted).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("records errors when delete fails", async () => {
    const file = createMockFile("receipts/u1/fail.jpg", TWENTY_FIVE_HOURS);
    (file.delete as jest.Mock).mockRejectedValue(new Error("permission denied"));
    const bucket = createMockBucket([file]);

    const result = await cleanupOldImages(bucket);

    expect(result.deleted).toEqual([]);
    expect(result.errors).toEqual(["receipts/u1/fail.jpg: permission denied"]);
  });

  it("accepts a custom maxAgeMs parameter", async () => {
    const file = createMockFile("receipts/u1/img.jpg", 2 * ONE_HOUR);
    const bucket = createMockBucket([file]);

    // 1 hour max age — file is 2 hours old, should be deleted
    const result = await cleanupOldImages(bucket, "receipts/", ONE_HOUR);

    expect(result.deleted).toEqual(["receipts/u1/img.jpg"]);
  });
});
