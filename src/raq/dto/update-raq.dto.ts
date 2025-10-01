import { PartialType } from '@nestjs/mapped-types';
import { CreateRaqDto } from './create-raq.dto';

export class UpdateRaqDto extends PartialType(CreateRaqDto) {}
