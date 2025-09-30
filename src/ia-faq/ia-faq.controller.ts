import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { IaFaqService } from './ia-faq.service';
import { CreateIaFaqDto } from './dto/create-ia-faq.dto';
import { UpdateIaFaqDto } from './dto/update-ia-faq.dto';

@Controller('ia-faq')
export class IaFaqController {
  constructor(private readonly iaFaqService: IaFaqService) {}

  @Post()
  create(@Body() createIaFaqDto: CreateIaFaqDto) {
    return this.iaFaqService.create(createIaFaqDto);
  }

  @Get()
  findAll() {
    return this.iaFaqService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.iaFaqService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateIaFaqDto: UpdateIaFaqDto) {
    return this.iaFaqService.update(+id, updateIaFaqDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.iaFaqService.remove(+id);
  }
}
