import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretCryptoService } from '../../common/crypto/secret-crypto.service';
import type { UpdatePlatformEmailSettingsDto } from './dto/update-platform-email-settings.dto';

const SINGLETON_ID = 'singleton';

@Injectable()
export class PlatformEmailSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: SecretCryptoService,
    private readonly config: ConfigService,
  ) {}

  async get() {
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: SINGLETON_ID } });
    return {
      m365ClientId: settings?.m365ClientId ?? null,
      hasM365ClientSecret: !!settings?.m365ClientSecretEncrypted,
      // Exatamente o que precisa ser cadastrado como Redirect URI no Azure —
      // exibido só de leitura na tela, pra não errar o caminho na mão.
      redirectUri: `${this.config.get<string>('API_URL', 'http://localhost:3001')}/api/v1/email-settings/m365/callback`,
      updatedAt: settings?.updatedAt ?? null,
    };
  }

  async update(dto: UpdatePlatformEmailSettingsDto) {
    const data: Record<string, unknown> = { m365ClientId: dto.m365ClientId };
    if (dto.m365ClientSecret) {
      data.m365ClientSecretEncrypted = this.crypto.encrypt(dto.m365ClientSecret);
    }
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));

    await this.prisma.platformSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...cleanData },
      update: cleanData,
    });
    return this.get();
  }
}
