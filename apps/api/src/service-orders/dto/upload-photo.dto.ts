import { IsEnum } from 'class-validator';

export enum ServiceOrderPhotoPhaseDto {
  BEFORE = 'BEFORE',
  AFTER = 'AFTER',
}

export class UploadPhotoDto {
  @IsEnum(ServiceOrderPhotoPhaseDto)
  phase!: ServiceOrderPhotoPhaseDto;
}
