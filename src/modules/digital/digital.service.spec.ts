import { Test, TestingModule } from '@nestjs/testing';
import { DigitalService } from './digital.service';

describe('DigitalService', () => {
  let service: DigitalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DigitalService],
    }).compile();

    service = module.get<DigitalService>(DigitalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
