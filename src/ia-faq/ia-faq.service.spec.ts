import { Test, TestingModule } from '@nestjs/testing';
import { IaFaqService } from './ia-faq.service';

describe('IaFaqService', () => {
  let service: IaFaqService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IaFaqService],
    }).compile();

    service = module.get<IaFaqService>(IaFaqService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
