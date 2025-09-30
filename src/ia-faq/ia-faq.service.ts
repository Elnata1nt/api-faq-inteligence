import { Injectable } from '@nestjs/common';
import { CreateIaFaqDto } from './dto/create-ia-faq.dto';
import { UpdateIaFaqDto } from './dto/update-ia-faq.dto';

@Injectable()
export class IaFaqService {
  create(createIaFaqDto: CreateIaFaqDto) {
    return 'This action adds a new iaFaq';
  }

  findAll() {
    return `This action returns all iaFaq`;
  }

  findOne(id: number) {
    return `This action returns a #${id} iaFaq`;
  }

  update(id: number, updateIaFaqDto: UpdateIaFaqDto) {
    return `This action updates a #${id} iaFaq`;
  }

  remove(id: number) {
    return `This action removes a #${id} iaFaq`;
  }
}
