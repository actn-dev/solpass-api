import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { TicketsGlobalController } from './tickets-global.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { EventsModule } from '../events/events.module';
import { Ticket } from './entities/ticket.entity';
import { TicketTransaction } from './entities/ticket-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketTransaction]),
    BlockchainModule,
    EventsModule,
  ],
  controllers: [TicketsController, TicketsGlobalController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
