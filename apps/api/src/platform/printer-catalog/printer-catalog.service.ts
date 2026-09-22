import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateCatalogModelDto } from './dto/create-catalog-model.dto';
import type { UpdateCatalogModelDto } from './dto/update-catalog-model.dto';

@Injectable()
export class PrinterCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.printerCatalogModel.findMany({ orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }] });
  }

  async findOne(id: string) {
    const entry = await this.prisma.printerCatalogModel.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundException('Modelo não encontrado no catálogo');
    }
    return entry;
  }

  create(dto: CreateCatalogModelDto) {
    return this.prisma.printerCatalogModel.create({
      data: { ...dto, researchedAt: new Date() } as any,
    });
  }

  async update(id: string, dto: UpdateCatalogModelDto) {
    await this.findOne(id);
    return this.prisma.printerCatalogModel.update({ where: { id }, data: dto as any });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.printerCatalogModel.delete({ where: { id } });
  }
}
