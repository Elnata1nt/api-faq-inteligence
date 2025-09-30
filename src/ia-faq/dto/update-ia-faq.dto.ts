import { PartialType } from '@nestjs/mapped-types';
import { CreateIaFaqDto } from './create-ia-faq.dto';

export class UpdateIaFaqDto extends PartialType(CreateIaFaqDto) {}
