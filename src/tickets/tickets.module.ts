import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [BlockchainModule, EventsModule],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
