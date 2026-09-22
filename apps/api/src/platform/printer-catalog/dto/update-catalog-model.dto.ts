import { PartialType } from '@nestjs/swagger';
import { CreateCatalogModelDto } from './create-catalog-model.dto';

export class UpdateCatalogModelDto extends PartialType(CreateCatalogModelDto) {}
