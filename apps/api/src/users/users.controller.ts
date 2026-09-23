import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('settings.manage')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @RequirePermissions('settings.manage')
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  // Full profile (role, permissões diretas, cliente vinculado, datas) pra
  // tela "Meu perfil" — GET /users/me só devolve o payload enxuto do JWT.
  // Sem settings.manage: qualquer usuário pode ver os próprios dados.
  @Get('me/full')
  meFull(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOne(user.id);
  }

  // Self-service — no settings.manage, just needs to be the logged-in user.
  // Declared before the generic ':id' routes so "me" isn't swallowed as a literal id.
  @Patch('me')
  updateMyProfile(@Body() dto: UpdateMyProfileDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.updateMyProfile(user.id, dto);
  }

  @Patch('me/password')
  changeMyPassword(@Body() dto: ChangeMyPasswordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.changeMyPassword(user.id, dto);
  }

  @Get(':id')
  @RequirePermissions('settings.manage')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('settings.manage')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('settings.manage')
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('settings.manage')
  activate(@Param('id') id: string) {
    return this.usersService.activate(id);
  }

  @Delete(':id')
  @RequirePermissions('settings.manage')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.remove(id, user.id);
  }
}
