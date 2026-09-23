import { PartialType } from '@nestjs/mapped-types';
import { CreateAgentReleaseDto } from './create-agent-release.dto';

export class UpdateAgentReleaseDto extends PartialType(CreateAgentReleaseDto) {}
