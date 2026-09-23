import { Module } from '@nestjs/common';
import { PrinterErrorCodesController } from './printer-error-codes.controller';
import { PrinterErrorCodesService } from './printer-error-codes.service';

@Module({
  controllers: [PrinterErrorCodesController],
  providers: [PrinterErrorCodesService],
})
export class PrinterErrorCodesModule {}
