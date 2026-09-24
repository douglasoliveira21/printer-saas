import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM
const KEY_LENGTH = 32; // AES-256

/**
 * Mirror of apps/api/src/common/crypto/secret-crypto.service.ts — same
 * AES-256-GCM algorithm/key-derivation/ciphertext format (`<iv>:<authTag>:
 * <encrypted>`, hex-joined), kept as a small standalone copy rather than a
 * shared import because packages/shared is deliberately Node-free (no
 * `node:crypto`/Buffer) so it stays safe to import from the frontend too.
 * Originally decrypt-only (SMTP/M365 credentials the API already
 * encrypted); encrypt() was added when Microsoft 365's delegated OAuth2
 * flow needed the worker to persist a rotated refresh token back to
 * TenantEmailSettings after each use (see graph-mailer.ts).
 */
@Injectable()
export class SecretCryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret = config.getOrThrow<string>('SECRET_ENCRYPTION_KEY');
    this.key = scryptSync(secret, 'printer-saas-secret-crypto', KEY_LENGTH);
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

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
