import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM
const KEY_LENGTH = 32; // AES-256

/**
 * Reversible at-rest encryption for secrets the API must hand back out in
 * plaintext later (SNMP v3 auth/priv passwords, delivered to the Agent via
 * GET /agent-api/v1/config) — unlike user passwords or Agent API keys, which
 * are hashed one-way with argon2 because we only ever need to *verify* them,
 * never read them back.
 *
 * Ciphertext format: `<iv>:<authTag>:<encrypted>`, each hex-encoded, so it's
 * a single opaque string safe to store directly in a text column.
 */
@Injectable()
export class SecretCryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret = config.getOrThrow<string>('SECRET_ENCRYPTION_KEY');
    // Derived via scrypt rather than stored/used raw so the env var can be
    // any length/format (e.g. a plain passphrase) while the actual AES key
    // is always exactly 32 bytes.
    this.key = scryptSync(secret, 'printer-saas-secret-crypto', KEY_LENGTH);
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /** Returns null instead of throwing on malformed/foreign ciphertext — callers treat a missing secret as "not configured", not a crash. */
  decrypt(cipherText: string): string | null {
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      return null;
    }
    try {
      const [ivHex, authTagHex, encryptedHex] = parts;
      const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      return null;
    }
  }
}
