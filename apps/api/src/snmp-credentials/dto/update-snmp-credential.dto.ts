import { PartialType } from '@nestjs/mapped-types';
import { CreateSnmpCredentialDto } from './create-snmp-credential.dto';

/** Passwords are optional on update — omitting them keeps whatever's already encrypted at rest; the service never blanks a password just because the field was left out of the request. */
export class UpdateSnmpCredentialDto extends PartialType(CreateSnmpCredentialDto) {}
