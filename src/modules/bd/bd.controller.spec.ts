import { Test, TestingModule } from '@nestjs/testing';
import { BdController } from './bd.controller';

describe('BdController', () => {
  let controller: BdController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BdController],
    }).compile();

    controller = module.get<BdController>(BdController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
