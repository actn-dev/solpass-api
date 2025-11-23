import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { SolanaTicketService } from './solana-ticket/solana-ticket.service';

@Module({
  providers: [TicketService, SolanaTicketService]
})
export class TicketModule {}
