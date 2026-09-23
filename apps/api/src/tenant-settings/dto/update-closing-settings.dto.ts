import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateClosingSettingsDto {
  @IsOptional()
  @IsBoolean()
  allowDisablingPrinterMonitoring?: boolean;

  @IsOptional()
  @IsBoolean()
  allowEditingClosingDocumentNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  hideUnknownLevelSupplies?: boolean;

  @IsOptional()
  @IsBoolean()
  hideNonTonerSupplies?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  closingReportTitle?: string;

  /** {columnKey: boolean} — see apps/frontend/.../configuracoes/empresa/report-columns.ts for the fixed key list. */
  @IsOptional()
  @IsObject()
  closingReportColumns?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  printUsageReportColumns?: Record<string, boolean>;

  @IsOptional()
  @IsString()
  additionalText?: string;
}
