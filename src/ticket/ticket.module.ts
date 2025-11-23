import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { SolanaTicketService } from './solana-ticket/solana-ticket.service';
import { TicketController } from './ticket.controller';
import { DevTestController } from './dev-test.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [BlockchainModule],
  providers: [TicketService, SolanaTicketService],
  controllers: [TicketController, DevTestController],
  exports: [TicketService],
})
export class TicketModule {}
