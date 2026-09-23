import { Module } from '@nestjs/common';
import { ReportEmailRecipientsController } from './report-email-recipients.controller';
import { ReportEmailRecipientsService } from './report-email-recipients.service';

@Module({
  controllers: [ReportEmailRecipientsController],
  providers: [ReportEmailRecipientsService],
  exports: [ReportEmailRecipientsService],
})
export class ReportEmailRecipientsModule {}
