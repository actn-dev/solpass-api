import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor';
import { Inject, Injectable, Logger } from '@nestjs/common';
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
import { solanaConfig } from 'src/config/solana.config';
import type { ConfigType } from '@nestjs/config';
import { NodeWallet } from './node-wallete';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { usdToMicroUsdc, microUsdcToUsd } from '../utils/currency.utils';

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
    @Inject(solanaConfig.KEY)
    config: ConfigType<typeof solanaConfig>,
  ) {
    this.programId = new PublicKey(config.programId);
    this.usdcMint = new PublicKey(USDC_MINT_PUBKEY);
    this.initializeProgram();
  }

  /**
   * Initialize Anchor program
   */
  private initializeProgram() {
    try {
      const wallet = new NodeWallet(this.serverWallet);
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
      const privateKey = bs58.encode(newKeypair.secretKey);

      // Derive event PDA
      const [eventPda] = this.pdaService.deriveEventPDA(
        this.programId,
        params.eventId,
      );

      // Check if account already exists on-chain
      const accountInfo = await this.connection.getAccountInfo(eventPda);
      if (accountInfo !== null) {
        this.logger.warn(
          `Event PDA ${eventPda.toBase58()} already exists on blockchain`,
        );
        throw new Error(
          `Event with ID "${params.eventId}" already exists on blockchain. The account ${eventPda.toBase58()} is already in use. Please use a different eventId.`,
        );
      }

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

      // Calculate distributed amounts (convert from micro-USDC to USD)
      const totalAmountMicroUsdc = (escrowAccount as any).usdcAmount.toNumber();
      const totalAmountUsd = microUsdcToUsd(totalAmountMicroUsdc);
      const distributedAmounts = royaltyPercentages.map((pct: number) =>
        parseFloat(((totalAmountUsd * pct) / 100).toFixed(2)),
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
   * Get escrow balance (royalties collected) in USD
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
      const microUsdc = (escrowAccount as any).usdcAmount.toNumber();
      return microUsdcToUsd(microUsdc);
    } catch (error) {
      this.logger.warn('Escrow account not found');
      return 0;
    }
  }

  /**
   * Verify ticket ownership
   * Returns true if the ticket exists and belongs to the claimed seller
   */
  async verifyTicketOwnership(
    eventPda: PublicKey,
    ticketId: string,
    claimedOwner: string,
  ): Promise<{ isValid: boolean; currentOwner?: string; ticketData?: any }> {
    try {
      const [ticketPda] = this.pdaService.deriveTicketPDA(
        this.programId,
        eventPda,
        ticketId,
      );

      const ticketData = await this.getTicketAccount(ticketPda);

      if (!ticketData) {
        // Ticket doesn't exist yet - valid for first purchase
        return { isValid: true };
      }

      // Check if claimed owner matches on-chain owner
      const isValid = ticketData.owner === claimedOwner;

      return {
        isValid,
        currentOwner: ticketData.owner,
        ticketData,
      };
    } catch (error) {
      this.logger.error('Error verifying ticket ownership:', error);
      return { isValid: false };
    }
  }

  /**
   * Get all tickets for an event by scanning program accounts
   */
  async getEventTickets(eventPda: PublicKey): Promise<any[]> {
    try {
      // Fetch all ticket accounts filtering by event PDA
      // TicketAccount layout: discriminator(8) + event(32) + owner + seller + ticket_id + ...
      // memcmp filter matches the 'event' field at offset 8
      // @ts-ignore
      const tickets = await this.program.account.ticketAccount.all([
        {
          memcmp: {
            offset: 8, // Skip 8-byte discriminator to get to the 'event' Pubkey field
            bytes: bs58.encode(eventPda.toBuffer()), // Encode as base58
          },
        },
      ]);

      this.logger.log(
        `Found ${tickets.length} tickets for event ${eventPda.toBase58()}`,
      );

      return tickets.map((ticket) => ({
        publicKey: ticket.publicKey.toBase58(),
        // @ts-ignore
        event: ticket.account.event.toBase58(),
        ticketId: ticket.account.ticketId,
        owner: ticket.account.owner,
        seller: ticket.account.seller,
        ticketPrice: microUsdcToUsd(Number(ticket.account.ticketPrice)),
        resellCount: ticket.account.resellCount,
        // @ts-ignore
        purchaseDate: ticket.account.purchaseDate.toNumber(),
      }));
    } catch (error) {
      this.logger.error('Error fetching event tickets:', error);
      return [];
    }
  }

  /**
   * Check if a wallet has a USDC token account
   */
  async checkUsdcAccountExists(owner: PublicKey): Promise<boolean> {
    try {
      const tokenAccountAddress = await getAssociatedTokenAddress(
        this.usdcMint,
        owner,
      );

      const accountInfo =
        await this.connection.getAccountInfo(tokenAccountAddress);

      return accountInfo !== null;
    } catch (error) {
      this.logger.warn(
        `USDC account not found for ${owner.toBase58()}: ${error}`,
      );
      return false;
    }
  }

  /**
   * Create USDC token account for a wallet if it doesn't exist
   * Server wallet pays for account creation
   */
  async createUsdcAccountIfNeeded(owner: PublicKey): Promise<{
    success: boolean;
    accountAddress: string;
    created: boolean;
    transactionSignature?: string;
    error?: string;
  }> {
    try {
      const tokenAccountAddress = await getAssociatedTokenAddress(
        this.usdcMint,
        owner,
      );

      // Check if account already exists
      const accountInfo =
        await this.connection.getAccountInfo(tokenAccountAddress);

      if (accountInfo !== null) {
        this.logger.log(
          `USDC account already exists for ${owner.toBase58()}: ${tokenAccountAddress.toBase58()}`,
        );
        return {
          success: true,
          accountAddress: tokenAccountAddress.toBase58(),
          created: false,
        };
      }

      // Create the account using token service
      this.logger.log(
        `Creating USDC account for ${owner.toBase58()} (server pays)`,
      );

      const account = await this.tokenService.getOrCreateTokenAccount(
        this.usdcMint,
        owner,
      );

      this.logger.log(`USDC account created/retrieved: ${account.toBase58()}`);

      return {
        success: true,
        accountAddress: account.toBase58(),
        created: true,
      };
    } catch (error) {
      this.logger.error(
        `Error creating USDC account for ${owner.toBase58()}: ${error}`,
      );
      return {
        success: false,
        accountAddress: '',
        created: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
