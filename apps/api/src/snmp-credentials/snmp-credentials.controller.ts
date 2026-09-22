import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SnmpCredentialsService } from './snmp-credentials.service';
import { CreateSnmpCredentialDto } from './dto/create-snmp-credential.dto';
import { UpdateSnmpCredentialDto } from './dto/update-snmp-credential.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

/** Managing shared SNMP v3 credential sets is a settings-level concern — same permission as `/tenant-settings`, not `agents.*`/`printers.*` (a technician who can edit printers shouldn't necessarily be able to read/rotate network secrets). */
@ApiTags('snmp-credentials')
@Controller('snmp-credentials')
export class SnmpCredentialsController {
  constructor(private readonly service: SnmpCredentialsService) {}

  @Get()
  @RequirePermissions('settings.manage')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermissions('settings.manage')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('settings.manage')
  create(@Body() dto: CreateSnmpCredentialDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('settings.manage')
  update(@Param('id') id: string, @Body() dto: UpdateSnmpCredentialDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('settings.manage')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
