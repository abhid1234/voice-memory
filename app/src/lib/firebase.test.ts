import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { 
  encryptText, 
  decryptText, 
  testFirebaseConnection, 
  pushMemosToFirestore, 
  pullMemosFromFirestore 
} from "./firebase";
import type { VoiceMemo } from "./storage";

describe("Firebase & Web Crypto Integration", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Polyfill window.crypto for tests if not available in global scope
    if (typeof window !== "undefined" && !window.crypto) {
      (window as any).crypto = globalThis.crypto;
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("AES-GCM Local Cryptography", () => {
    it("should successfully encrypt and decrypt a text string", async () => {
      const plaintext = "My secret memory text";
      const password = "secure-passcode-123";

      const encrypted = await encryptText(plaintext, password);
      expect(encrypted).toBeTypeOf("string");
      expect(encrypted).not.toBe(plaintext);

      const decrypted = await decryptText(encrypted, password);
      expect(decrypted).toBe(plaintext);
    });

    it("should throw an error if decrypting with a wrong password", async () => {
      const plaintext = "Secret information";
      const password = "correct-password";
      const wrongPassword = "wrong-password";

      const encrypted = await encryptText(plaintext, password);
      await expect(decryptText(encrypted, wrongPassword)).rejects.toThrow();
    });
  });

  describe("testFirebaseConnection", () => {
    it("should return true for status < 400", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await testFirebaseConnection("key", "project");
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://firestore.googleapis.com/v1/projects/project/databases/(default)/documents?key=key&pageSize=1"
      );
    });

    it("should return false for status >= 400", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 403,
        ok: false,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await testFirebaseConnection("key", "project");
      expect(result).toBe(false);
    });
  });

  describe("Firestore push & pull sync operations", () => {
    const sampleMemos: VoiceMemo[] = [
      {
        id: 1,
        timestamp: 1716768000000,
        transcript: "Memo one transcript text",
        tags: ["work", "notes"],
      },
    ];

    it("should push memos to Firestore with correct REST mapping and encryption", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      vi.stubGlobal("fetch", mockFetch);

      await pushMemosToFirestore("apiKey", "projectId", sampleMemos, "password");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = mockFetch.mock.calls[0];

      expect(calledUrl).toContain("projectId");
      expect(calledUrl).toContain("key=apiKey");
      expect(calledInit.method).toBe("POST");

      const body = JSON.parse(calledInit.body);
      expect(body.writes).toHaveLength(1);
      
      const write = body.writes[0];
      expect(write.update.name).toBe("projects/projectId/databases/(default)/documents/memos/memo_1");
      
      const fields = write.update.fields;
      expect(fields.id.integerValue).toBe("1");
      expect(fields.timestamp.integerValue).toBe("1716768000000");
      expect(fields.isEncrypted.booleanValue).toBe(true);
      
      // Transcript must be encrypted (should not be the raw string)
      expect(fields.transcript.stringValue).not.toBe(sampleMemos[0].transcript);
    });

    it("should pull memos from Firestore and decrypt them", async () => {
      const encryptedTranscript = await encryptText("Decrypted text", "password");
      
      const mockApiResponse = {
        documents: [
          {
            name: "projects/projectId/databases/(default)/documents/memos/memo_1",
            fields: {
              id: { integerValue: "1" },
              timestamp: { integerValue: "1716768000000" },
              transcript: { stringValue: encryptedTranscript },
              isEncrypted: { booleanValue: true },
              tags: { arrayValue: { values: [{ stringValue: "work" }] } },
            },
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockApiResponse),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await pullMemosFromFirestore("apiKey", "projectId", "password");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].transcript).toBe("Decrypted text");
      expect(result[0].tags).toEqual(["work"]);
    });
  });
});
