import { Test, TestingModule } from '@nestjs/testing';
import { IaFaqController } from './ia-faq.controller';
import { IaFaqService } from './ia-faq.service';

describe('IaFaqController', () => {
  let controller: IaFaqController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IaFaqController],
      providers: [IaFaqService],
    }).compile();

    controller = module.get<IaFaqController>(IaFaqController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
