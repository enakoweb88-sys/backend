import { Test, TestingModule } from '@nestjs/testing';
import { BdService } from './bd.service';

describe('BdService', () => {
  let service: BdService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BdService],
    }).compile();

    service = module.get<BdService>(BdService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
