import { Module } from '@nestjs/common';
import { EmailSettingsController } from './email-settings.controller';
import { EmailSettingsService } from './email-settings.service';
import { NotificationSettingsController } from './notification-settings.controller';
import { NotificationSettingsService } from './notification-settings.service';
import { ReportDeliveriesController } from './report-deliveries.controller';
import { ReportDeliveriesService } from './report-deliveries.service';
import { SecretCryptoService } from '../../common/crypto/secret-crypto.service';

@Module({
  controllers: [EmailSettingsController, NotificationSettingsController, ReportDeliveriesController],
  providers: [EmailSettingsService, NotificationSettingsService, ReportDeliveriesService, SecretCryptoService],
})
export class EmailSettingsModule {}
