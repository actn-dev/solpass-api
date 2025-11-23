import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TicketModule } from './ticket/ticket.module';

import solanaConfig from './config/configuration';
import { ConfigModule } from '@nestjs/config';
import { BlockchainModule } from './blockchain/blockchain.module';
import { PartnerModule } from './partner/partner.module';

@Module({
  imports: [
    TicketModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [solanaConfig],
    }),
    BlockchainModule,
    PartnerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
