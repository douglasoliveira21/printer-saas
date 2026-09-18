import { IsOptional, IsString, MinLength } from 'class-validator';

export class ApproveServiceOrderDto {
  @IsString()
  @MinLength(1)
  approvalName!: string;

  @IsString()
  @MinLength(1)
  approvalSignature!: string; // PNG base64 data URL from the signature canvas

  @IsOptional()
  @IsString()
  approvalNotes?: string;
}
