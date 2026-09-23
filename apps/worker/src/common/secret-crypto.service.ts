import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDecipheriv, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // AES-256

/**
 * Decrypt-only mirror of apps/api/src/common/crypto/secret-crypto.service.ts
 * — same AES-256-GCM algorithm/key-derivation/ciphertext format (`<iv>:
 * <authTag>:<encrypted>`, hex-joined), kept as a small standalone copy
 * rather than a shared import because packages/shared is deliberately
 * Node-free (no `node:crypto`/Buffer) so it stays safe to import from the
 * frontend too. The worker only ever needs to decrypt (SMTP/M365
 * credentials the API already encrypted), never encrypt.
 */
@Injectable()
export class SecretCryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret = config.getOrThrow<string>('SECRET_ENCRYPTION_KEY');
    this.key = scryptSync(secret, 'printer-saas-secret-crypto', KEY_LENGTH);
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
