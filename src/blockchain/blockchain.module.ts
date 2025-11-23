import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SolanaService } from './services/solana.service';
import { TokenService } from './services/token.service';
import { PdaService } from './services/pda.service';
import { TransactionService } from './services/transaction.service';
import { SolanaTicketService } from './solana-ticket/solana-ticket.service';
import { ConnectionProvider } from './providers/connection.provider';
import { WalletProvider } from './providers/wallet.provider';
import { SERVER_WALLET, SOLANA_CONNECTION } from './constants/solana.constants';

@Module({
  imports: [ConfigModule],
  providers: [
    // Connection & Wallet providers
    ConnectionProvider,
    WalletProvider,

    // Services
    SolanaService,
    TokenService,
    PdaService,
    TransactionService,
    SolanaTicketService,
  ],
  exports: [
    // Export for use in other modules
    SOLANA_CONNECTION,
    SERVER_WALLET,
    SolanaService,
    TokenService,
    PdaService,
    TransactionService,
    SolanaTicketService,
  ],
})
export class BlockchainModule {}
