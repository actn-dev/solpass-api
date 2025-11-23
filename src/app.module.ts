import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TicketModule } from './ticket/ticket.module';

import solanaConfig from './config/configuration';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TicketModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [solanaConfig],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
