// Encrypts connector credentials at rest (AES-256-GCM).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

let key: Buffer | null = null;
function getKey(): Buffer {
  if (key) return key;
  if (process.env.SPARKFORGE_SECRET) {
    key = createHash("sha256").update(process.env.SPARKFORGE_SECRET).digest();
  } else {
    const file = process.env.SPARKFORGE_KEY_FILE ?? "data/secret.key";
    if (!existsSync(file)) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600 });
    }
    key = Buffer.from(readFileSync(file, "utf8").trim(), "base64");
  }
  return key;
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function unseal(sealed: string): string {
  const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", getKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
