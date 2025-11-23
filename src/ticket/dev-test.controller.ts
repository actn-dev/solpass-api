import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { SolanaService } from '../blockchain/services/solana.service';
import { PdaService } from '../blockchain/services/pda.service';
import { TokenService } from '../blockchain/services/token.service';
import { ConfigService } from '@nestjs/config';
import { PublicKey } from '@solana/web3.js';

@ApiTags('Development & Testing')
@Controller('dev/test')
export class DevTestController {
  constructor(
    private readonly solanaService: SolanaService,
    private readonly pdaService: PdaService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  @Get('connection')
  @ApiOperation({ summary: 'Test Solana RPC connection' })
  async testConnection() {
    try {
      const connection = this.solanaService.getConnection();
      const slot = await connection.getSlot();
      const version = await connection.getVersion();

      return {
        success: true,
        status: 'connected',
        cluster: this.configService.get('solana.cluster'),
        rpcUrl: this.configService.get('solana.rpcUrl'),
        currentSlot: slot,
        solanaVersion: version,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('wallet')
  @ApiOperation({ summary: 'Get server wallet information' })
  async getWallet() {
    try {
      const address = this.solanaService.getServerWalletAddress();
      const connection = this.solanaService.getConnection();
      const balance = await connection.getBalance(new PublicKey(address));

      return {
        success: true,
        address,
        balanceSOL: balance / 1e9, // Convert lamports to SOL
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('pda/event/:eventId')
  @ApiOperation({ summary: 'Derive event PDA for testing' })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  async deriveEventPDA(@Param('eventId') eventId: string) {
    try {
      const programId = new PublicKey(
        this.configService.get<string>('solana.programId')!,
      );
      const authority = new PublicKey(
        this.solanaService.getServerWalletAddress(),
      );

      const [eventPda, bump] = this.pdaService.deriveEventPDA(
        programId,
        authority,
        eventId,
      );

      return {
        success: true,
        eventId,
        eventPda: eventPda.toBase58(),
        bump,
        authority: authority.toBase58(),
        programId: programId.toBase58(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('pda/ticket/:eventId/:ticketId')
  @ApiOperation({ summary: 'Derive ticket PDA for testing' })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  @ApiParam({ name: 'ticketId', example: 'ticket-001' })
  async deriveTicketPDA(
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
  ) {
    try {
      const programId = new PublicKey(
        this.configService.get<string>('solana.programId')!,
      );
      const authority = new PublicKey(
        this.solanaService.getServerWalletAddress(),
      );

      const [eventPda] = this.pdaService.deriveEventPDA(
        programId,
        authority,
        eventId,
      );
      const [ticketPda, bump] = this.pdaService.deriveTicketPDA(
        programId,
        eventPda,
        ticketId,
      );

      return {
        success: true,
        eventId,
        ticketId,
        eventPda: eventPda.toBase58(),
        ticketPda: ticketPda.toBase58(),
        bump,
        programId: programId.toBase58(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('usdc-balance/:walletAddress')
  @ApiOperation({ summary: 'Check USDC balance for a wallet' })
  @ApiParam({
    name: 'walletAddress',
    example: '7xKzU8fPPwV3wkF9YqGVXJb4qQZ3GqYvJ9Z3sV7wV7wV',
  })
  async getUsdcBalance(@Param('walletAddress') walletAddress: string) {
    try {
      const owner = new PublicKey(walletAddress);
      const balance = await this.tokenService.getUsdcBalance(owner);

      return {
        success: true,
        walletAddress,
        usdcBalance: balance,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('config')
  @ApiOperation({ summary: 'Get current configuration' })
  getConfig() {
    return {
      success: true,
      config: {
        programId: this.configService.get('solana.programId'),
        cluster: this.configService.get('solana.cluster'),
        rpcUrl: this.configService.get('solana.rpcUrl'),
        usdcMint: this.configService.get('solana.usdcMint'),
      },
    };
  }
}
