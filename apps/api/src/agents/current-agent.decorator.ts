import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Agent } from '@prisma/client';

export const CurrentAgent = createParamDecorator((_data: unknown, ctx: ExecutionContext): Agent => {
  return ctx.switchToHttp().getRequest().agent;
});
