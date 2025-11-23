import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { PdaService } from '../../blockchain/services/pda.service';
import { SolanaService } from '../../blockchain/services/solana.service';
import { TokenService } from '../../blockchain/services/token.service';
import idl from './ticket-idl.json';
import {
  SERVER_WALLET,
  SOLANA_CONNECTION,
  USDC_MINT_PUBKEY,
} from 'src/blockchain/constants/solana.constants';
import { SolanaConfig } from 'src/config/configuration';

@Injectable()
export class SolanaTicketService {
  private readonly logger = new Logger(SolanaTicketService.name);
  private program: Program;
  private readonly programId: PublicKey;
  private readonly usdcMint: PublicKey;

  constructor(
    @Inject(SOLANA_CONNECTION) private readonly connection: Connection,
    @Inject(SERVER_WALLET) private readonly serverWallet: Keypair,
    private readonly solanaService: SolanaService,
    private readonly pdaService: PdaService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {
    const solanaConfig = this.configService.getOrThrow<SolanaConfig>('solana');
    this.programId = new PublicKey(solanaConfig.programId);
    this.usdcMint = new PublicKey(USDC_MINT_PUBKEY);
    this.initializeProgram();
  }

  /**
   * Initialize Anchor program
   */
  private initializeProgram() {
    try {
      const wallet = new Wallet(this.serverWallet);
      const provider = new AnchorProvider(this.connection, wallet, {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      });

      this.program = new Program(idl as any, this.programId, provider);
      this.logger.log('Anchor program initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Anchor program:', error);
      throw error;
    }
  }

  /**
   * Create a new event on-chain
   */
  async createEvent(params: {
    eventId: string;
    name: string;
    royalty: string;
  }): Promise<{
    signature: string;
    eventPda: PublicKey;
    eventKeypair: { publicKey: string; privateKey: string };
  }> {
    try {
      this.logger.log(`Creating event: ${params.eventId}`);

      // Generate a new keypair for the event
      const newKeypair = Keypair.generate();
      const publicKey = newKeypair.publicKey.toBase58();
      const privateKey = Buffer.from(newKeypair.secretKey).toString('base64');

      // Derive event PDA
      const [eventPda] = this.pdaService.deriveEventPDA(
        this.programId,
        params.eventId,
      );

      // Call createEvent instruction (only 3 params: eventId, name, royalty)
      // @ts-ignore
      const signature = await this.program.methods
        .createEvent(params.eventId, params.name, params.royalty)
        .accounts({
          eventAccount: eventPda,
          authority: this.serverWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      this.logger.log(`Event created: ${signature}`);

      return {
        signature,
        eventPda,
        eventKeypair: {
          publicKey,
          privateKey,
        },
      };
    } catch (error) {
      this.logger.error('Error creating event:', error);
      throw new Error(
        `Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Resell/Purchase ticket (handles first purchase and resales)
   */
  async resellTicket(params: {
    eventPda: PublicKey;
    ticketId: string;
    sellerId: string;
    buyerId: string;
    price: number;
    originalPrice: number;
  }): Promise<{
    signature: string;
    ticketPda: PublicKey;
    resellCount: number;
  }> {
    try {
      this.logger.log(`Processing ticket transaction: ${params.ticketId}`);

      // Derive ticket PDA
      const [ticketPda] = this.pdaService.deriveTicketPDA(
        this.programId,
        params.eventPda,
        params.ticketId,
      );

      // Derive royalty escrow PDA
      const [royaltyEscrowPda] = this.pdaService.deriveRoyaltyEscrowPDA(
        this.programId,
        params.eventPda,
      );

      // Get buyer's USDC token account
      const buyerUsdcAccount = await getAssociatedTokenAddress(
        this.usdcMint,
        this.serverWallet.publicKey,
      );

      // Get escrow's USDC token account
      const escrowUsdcAccount = await getAssociatedTokenAddress(
        this.usdcMint,
        royaltyEscrowPda,
        true, // Allow owner to be a PDA
      );

      this.logger.debug('Account addresses:');
      this.logger.debug(`- Ticket PDA: ${ticketPda.toBase58()}`);
      this.logger.debug(`- Royalty Escrow PDA: ${royaltyEscrowPda.toBase58()}`);
      this.logger.debug(`- Buyer USDC Account: ${buyerUsdcAccount.toBase58()}`);
      this.logger.debug(
        `- Escrow USDC Account: ${escrowUsdcAccount.toBase58()}`,
      );

      // Call resellTicket instruction
      // @ts-ignore
      const signature = await this.program.methods
        .resellTicket(
          params.ticketId,
          params.sellerId,
          params.buyerId,
          new BN(params.price),
          new BN(params.originalPrice),
        )
        .accounts({
          ticketAccount: ticketPda,
          eventAccount: params.eventPda,
          royaltyEscrow: royaltyEscrowPda,
          buyerAccount: this.serverWallet.publicKey,
          sellerAccount: this.serverWallet.publicKey,
          buyerUsdcAccount: buyerUsdcAccount,
          escrowUsdcAccount: escrowUsdcAccount,
          usdcMint: this.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Fetch updated ticket account
      let resellCount = 0;
      try {
        // @ts-ignore
        const ticketAccount =
          // @ts-ignore
          await this.program.account.ticketAccount.fetch(ticketPda);
        resellCount = (ticketAccount as any).resellCount;
      } catch (error) {
        this.logger.warn('Could not fetch updated ticket account');
      }

      this.logger.log(`Ticket transaction completed: ${signature}`);

      return { signature, ticketPda, resellCount };
    } catch (error) {
      this.logger.error('Error processing ticket transaction:', error);
      throw new Error(
        `Failed to process ticket: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Distribute royalties to party wallets
   */
  async distributeRoyalty(params: {
    eventPda: PublicKey;
    authority: PublicKey;
    partyWalletAddresses: string[];
  }): Promise<{ signature: string; distributedAmounts: number[] }> {
    try {
      this.logger.log(
        `Distributing royalties for event: ${params.eventPda.toBase58()}`,
      );

      // Validate party count
      if (
        params.partyWalletAddresses.length === 0 ||
        params.partyWalletAddresses.length > 12
      ) {
        throw new Error('Must provide 1-12 party wallet addresses');
      }

      // Derive royalty escrow PDA
      const [royaltyEscrowPda] = this.pdaService.deriveRoyaltyEscrowPDA(
        this.programId,
        params.eventPda,
      );

      // Check escrow balance
      let escrowAccount;
      try {
        // @ts-ignore
        escrowAccount =
          // @ts-ignore
          await this.program.account.royaltyEscrow.fetch(royaltyEscrowPda);
        const usdcAmount = (escrowAccount as any).usdcAmount.toNumber();

        if (usdcAmount === 0) {
          this.logger.warn('No royalties to distribute (escrow is empty)');
          return { signature: '', distributedAmounts: [] };
        }

        this.logger.log(`Escrow balance: ${usdcAmount} USDC tokens (scaled)`);
      } catch (error) {
        throw new Error(
          'Royalty escrow account not found. No resales have occurred yet.',
        );
      }

      // Get event data to parse royalty percentages
      let eventData;
      try {
        // @ts-ignore - Anchor account typing
        eventData = await this.program.account.eventAccount.fetch(
          params.eventPda,
        );
      } catch (error) {
        throw new Error('Could not fetch event data');
      }

      // Parse royalty percentages
      const royaltyPercentages = (eventData as any).royalty
        .split(',')
        .map((pct: string) => parseInt(pct.trim()))
        .filter((pct: number) => !isNaN(pct));

      // Validate party count matches royalty percentages
      if (royaltyPercentages.length !== params.partyWalletAddresses.length) {
        throw new Error(
          `Mismatch: ${royaltyPercentages.length} royalty percentages but ${params.partyWalletAddresses.length} party wallets`,
        );
      }

      // Get escrow's USDC account
      const escrowUsdcAccount = await getAssociatedTokenAddress(
        this.usdcMint,
        royaltyEscrowPda,
        true,
      );

      // Create party USDC accounts and remaining accounts array
      const remainingAccountMetas: Array<{
        pubkey: PublicKey;
        isWritable: boolean;
        isSigner: boolean;
      }> = [];

      for (const walletAddress of params.partyWalletAddresses) {
        const partyWallet = new PublicKey(walletAddress);
        const partyUsdcAccount = await getAssociatedTokenAddress(
          this.usdcMint,
          partyWallet,
        );

        remainingAccountMetas.push({
          pubkey: partyUsdcAccount,
          isWritable: true,
          isSigner: false,
        });
      }

      this.logger.log(
        `Distributing to ${remainingAccountMetas.length} parties`,
      );

      // Call distributeRoyalty instruction
      // @ts-ignore
      const signature = await this.program.methods
        .distributeRoyalty()
        .accounts({
          eventAccount: params.eventPda,
          royaltyEscrow: royaltyEscrowPda,
          authority: params.authority,
          escrowUsdcAccount: escrowUsdcAccount,
          usdcMint: this.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccountMetas)
        .rpc();

      this.logger.log(`Royalties distributed: ${signature}`);

      // Calculate distributed amounts
      const totalAmount = (escrowAccount as any).usdcAmount.toNumber();
      const distributedAmounts = royaltyPercentages.map((pct: number) =>
        Math.floor((totalAmount * pct) / 100),
      );

      return { signature, distributedAmounts };
    } catch (error) {
      this.logger.error('Error distributing royalties:', error);
      throw new Error(
        `Failed to distribute royalties: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get event account data
   */
  async getEventAccount(eventPda: PublicKey): Promise<any> {
    try {
      const eventAccount =
        // @ts-ignore - Anchor account typing
        await this.program.account.eventAccount.fetch(eventPda);
      return eventAccount;
    } catch (error) {
      this.logger.error('Error fetching event account:', error);
      return null;
    }
  }

  /**
   * Get ticket account data
   */
  async getTicketAccount(ticketPda: PublicKey): Promise<any> {
    try {
      const ticketAccount =
        // @ts-ignore - Anchor account typing
        await this.program.account.ticketAccount.fetch(ticketPda);
      return ticketAccount;
    } catch (error) {
      this.logger.error('Error fetching ticket account:', error);
      return null;
    }
  }

  /**
   * Get escrow balance
   */
  async getEscrowBalance(eventPda: PublicKey): Promise<number> {
    try {
      const [royaltyEscrowPda] = this.pdaService.deriveRoyaltyEscrowPDA(
        this.programId,
        eventPda,
      );

      const escrowAccount =
        // @ts-ignore - Anchor account typing
        await this.program.account.royaltyEscrow.fetch(royaltyEscrowPda);
      return (escrowAccount as any).usdcAmount.toNumber();
    } catch (error) {
      this.logger.warn('Escrow account not found');
      return 0;
    }
  }
}
