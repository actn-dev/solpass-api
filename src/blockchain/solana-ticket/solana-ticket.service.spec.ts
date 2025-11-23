import { Test, TestingModule } from '@nestjs/testing';
import { SolanaTicketService } from './solana-ticket.service';

describe('SolanaTicketService', () => {
  let service: SolanaTicketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SolanaTicketService],
    }).compile();

    service = module.get<SolanaTicketService>(SolanaTicketService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
