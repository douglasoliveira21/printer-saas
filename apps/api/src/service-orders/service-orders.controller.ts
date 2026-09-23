import { join, extname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { ListServiceOrdersQueryDto } from './dto/list-service-orders-query.dto';
import { AddPartDto } from './dto/add-part.dto';
import { ApproveServiceOrderDto } from './dto/approve-service-order.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';

@ApiTags('service-orders')
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Post()
  @RequirePermissions('service_orders.create')
  create(@Body() dto: CreateServiceOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.serviceOrdersService.create(dto, user.id);
  }

  @Get()
  @RequirePermissions('service_orders.view')
  findAll(@Query() query: ListServiceOrdersQueryDto) {
    return this.serviceOrdersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('service_orders.view')
  findOne(@Param('id') id: string) {
    return this.serviceOrdersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('service_orders.edit')
  update(@Param('id') id: string, @Body() dto: UpdateServiceOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.serviceOrdersService.update(id, dto, user);
  }

  @Get(':id/pdf')
  @RequirePermissions('service_orders.view')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.serviceOrdersService.generatePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="os-${id}.pdf"`);
    res.send(buffer);
  }

  @Post(':id/parts')
  @RequirePermissions('service_orders.edit')
  addPart(@Param('id') id: string, @Body() dto: AddPartDto) {
    return this.serviceOrdersService.addPart(id, dto);
  }

  @Delete(':id/parts/:partId')
  @RequirePermissions('service_orders.edit')
  removePart(@Param('id') id: string, @Param('partId') partId: string) {
    return this.serviceOrdersService.removePart(id, partId);
  }

  @Post(':id/photos')
  @RequirePermissions('service_orders.edit')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'service-orders', String(req.params.id));
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Apenas imagens são permitidas'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadPhoto(@Param('id') id: string, @Body() dto: UploadPhotoDto, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    return this.serviceOrdersService.addPhoto(id, dto.phase, `service-orders/${id}/${file.filename}`);
  }

  @Delete(':id/photos/:photoId')
  @RequirePermissions('service_orders.edit')
  removePhoto(@Param('id') id: string, @Param('photoId') photoId: string) {
    return this.serviceOrdersService.removePhoto(id, photoId);
  }

  @Post(':id/approve')
  @RequirePermissions('service_orders.edit')
  approve(@Param('id') id: string, @Body() dto: ApproveServiceOrderDto) {
    return this.serviceOrdersService.approve(id, dto);
  }
}
