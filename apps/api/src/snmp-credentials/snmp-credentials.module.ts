import { Module } from '@nestjs/common';
import { SnmpCredentialsController } from './snmp-credentials.controller';
import { SnmpCredentialsService } from './snmp-credentials.service';
import { SecretCryptoService } from '../common/crypto/secret-crypto.service';

@Module({
  controllers: [SnmpCredentialsController],
  providers: [SnmpCredentialsService, SecretCryptoService],
  exports: [SecretCryptoService],
})
export class SnmpCredentialsModule {}
