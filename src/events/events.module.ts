import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event } from './entities/event.entity';
import { EventOwnerGuard } from './guards/event-owner.guard';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), BlockchainModule, UsersModule],
  controllers: [EventsController],
  providers: [EventsService, EventOwnerGuard],
  exports: [EventsService],
})
export class EventsModule {}
