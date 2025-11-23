import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { PdaService } from '../blockchain/services/pda.service';
import { SolanaService } from '../blockchain/services/solana.service';
import { CreateEventDto } from './dto/create-event.dto';
import { DistributeRoyaltyDto } from './dto/distribute-royalty.dto';
import { PurchaseTicketDto } from './dto/purchase-ticket.dto';
import { SolanaTicketService } from './solana-ticket/solana-ticket.service';
import { ConfigService } from '@nestjs/config';
import { SolanaConfig } from 'src/config/configuration';

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);
  private readonly programId: PublicKey;

  constructor(
    private readonly solanaTicketService: SolanaTicketService,
    private readonly solanaService: SolanaService,
    private readonly pdaService: PdaService,
    private readonly configService: ConfigService,
  ) {
    this.programId = new PublicKey(
      this.configService.getOrThrow<SolanaConfig>('solana').programId,
    );
  }

  /**
   * Create a new event
   */
  async createEvent(dto: CreateEventDto) {
    try {
      this.logger.log(`Creating event: ${dto.eventId}`);

      // Convert authority string to PublicKey
      const authority = new PublicKey(dto.authority);

      // Convert eventDate to Date object
      const eventDate = new Date(dto.eventDate);

      // Call blockchain service
      const { signature, eventPda } =
        await this.solanaTicketService.createEvent({
          eventId: dto.eventId,
          name: dto.name,
          description: dto.description,
          royalty: dto.royalty,
          venue: dto.venue,
          eventDate,
          totalTickets: dto.totalTickets,
          ticketPrice: dto.ticketPrice,
          authority,
        });

      // Wait for confirmation
      const confirmed = await this.solanaService.waitForConfirmation(signature);

      if (!confirmed) {
        throw new Error('Transaction confirmation timeout');
      }

      // Fetch on-chain event data
      const eventData =
        await this.solanaTicketService.getEventAccount(eventPda);

      return {
        success: true,
        transactionSignature: signature,
        eventPda: eventPda.toBase58(),
        eventData: {
          eventId: dto.eventId,
          name: eventData?.name || dto.name,
          authority: dto.authority,
          ticketsSold: eventData?.ticketsSold || 0,
          isActive: eventData?.isActive ?? true,
        },
      };
    } catch (error) {
      this.logger.error('Error creating event:', error);
      throw new BadRequestException(
        `Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Purchase or resell a ticket
   */
  async purchaseTicket(eventId: string, dto: PurchaseTicketDto) {
    try {
      this.logger.log(
        `Processing ticket purchase: ${dto.ticketId} for event: ${eventId}`,
      );

      // Derive event PDA
      const authority = new PublicKey(
        this.solanaService.getServerWalletAddress(),
      );
      const [eventPda] = this.pdaService.deriveEventPDA(
        this.programId,
        authority,
        eventId,
      );

      // Check if event exists and is active
      const eventData =
        await this.solanaTicketService.getEventAccount(eventPda);
      if (!eventData) {
        throw new NotFoundException(`Event ${eventId} not found`);
      }

      if (!eventData.isActive) {
        throw new BadRequestException('Event is not active');
      }

      // Call blockchain service to resell/purchase ticket
      const { signature, ticketPda, resellCount } =
        await this.solanaTicketService.resellTicket({
          eventPda,
          ticketId: dto.ticketId,
          sellerId: dto.sellerId,
          buyerId: dto.buyerId,
          price: dto.newPrice,
          originalPrice: dto.originalPrice,
        });

      // Wait for confirmation
      const confirmed = await this.solanaService.waitForConfirmation(signature);

      if (!confirmed) {
        throw new Error('Transaction confirmation timeout');
      }

      // Fetch updated ticket data
      const ticketData =
        await this.solanaTicketService.getTicketAccount(ticketPda);

      return {
        success: true,
        transactionSignature: signature,
        ticketPda: ticketPda.toBase58(),
        ticketData: {
          ticketId: dto.ticketId,
          owner: ticketData?.owner || dto.buyerId,
          seller: ticketData?.seller || dto.sellerId,
          currentPrice: dto.newPrice,
          resellCount: resellCount,
          eventPda: eventPda.toBase58(),
        },
      };
    } catch (error) {
      this.logger.error('Error purchasing ticket:', error);
      throw new BadRequestException(
        `Failed to purchase ticket: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Distribute royalties for an event
   */
  async distributeRoyalty(eventId: string, dto: DistributeRoyaltyDto) {
    try {
      this.logger.log(`Distributing royalties for event: ${eventId}`);

      // Convert authority to PublicKey
      const authority = new PublicKey(dto.authority);

      // Derive event PDA
      const [eventPda] = this.pdaService.deriveEventPDA(
        this.programId,
        authority,
        eventId,
      );

      // Check if event exists
      const eventData =
        await this.solanaTicketService.getEventAccount(eventPda);
      if (!eventData) {
        throw new NotFoundException(`Event ${eventId} not found`);
      }

      // Verify authority matches event creator
      if (eventData.authority.toBase58() !== dto.authority) {
        throw new BadRequestException(
          'Authority mismatch: not the event creator',
        );
      }

      // Check if already distributed
      if (eventData.royaltyDistributed) {
        throw new BadRequestException(
          'Royalties already distributed for this event',
        );
      }

      // Get escrow balance
      const escrowBalance =
        await this.solanaTicketService.getEscrowBalance(eventPda);
      if (escrowBalance === 0) {
        throw new BadRequestException(
          'No royalties to distribute (escrow is empty)',
        );
      }

      // Call blockchain service
      const { signature, distributedAmounts } =
        await this.solanaTicketService.distributeRoyalty({
          eventPda,
          authority,
          partyWalletAddresses: dto.partyAddresses,
        });

      // Wait for confirmation
      const confirmed = await this.solanaService.waitForConfirmation(signature);

      if (!confirmed) {
        throw new Error('Transaction confirmation timeout');
      }

      return {
        success: true,
        transactionSignature: signature,
        eventPda: eventPda.toBase58(),
        distribution: {
          totalAmount: escrowBalance,
          partyAddresses: dto.partyAddresses,
          distributedAmounts,
        },
      };
    } catch (error) {
      this.logger.error('Error distributing royalties:', error);
      throw new BadRequestException(
        `Failed to distribute royalties: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get event details
   */
  async getEvent(eventId: string) {
    try {
      // For now, use server wallet as authority
      // In production, you'd look this up from database
      const authority = new PublicKey(
        this.solanaService.getServerWalletAddress(),
      );
      const [eventPda] = this.pdaService.deriveEventPDA(
        this.programId,
        authority,
        eventId,
      );

      const eventData =
        await this.solanaTicketService.getEventAccount(eventPda);

      if (!eventData) {
        throw new NotFoundException(`Event ${eventId} not found`);
      }

      return {
        success: true,
        eventPda: eventPda.toBase58(),
        eventData: {
          eventId,
          name: eventData.name,
          authority: eventData.authority.toBase58(),
          royalty: eventData.royalty,
          ticketsSold: eventData.ticketsSold,
          isActive: eventData.isActive,
          royaltyDistributed: eventData.royaltyDistributed,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching event:', error);
      throw new NotFoundException(
        `Event not found: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get ticket details
   */
  async getTicket(eventId: string, ticketId: string) {
    try {
      // Derive event PDA
      const authority = new PublicKey(
        this.solanaService.getServerWalletAddress(),
      );
      const [eventPda] = this.pdaService.deriveEventPDA(
        this.programId,
        authority,
        eventId,
      );

      // Derive ticket PDA
      const [ticketPda] = this.pdaService.deriveTicketPDA(
        this.programId,
        eventPda,
        ticketId,
      );

      const ticketData =
        await this.solanaTicketService.getTicketAccount(ticketPda);

      if (!ticketData) {
        throw new NotFoundException(`Ticket ${ticketId} not found`);
      }

      return {
        success: true,
        ticketPda: ticketPda.toBase58(),
        ticketData: {
          ticketId,
          owner: ticketData.owner,
          seller: ticketData.seller,
          ticketPrice: ticketData.ticketPrice,
          resellCount: ticketData.resellCount,
          purchaseDate: ticketData.purchaseDate,
          eventPda: eventPda.toBase58(),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching ticket:', error);
      throw new NotFoundException(
        `Ticket not found: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get escrow balance for an event
   */
  async getEscrowBalance(eventId: string) {
    try {
      const authority = new PublicKey(
        this.solanaService.getServerWalletAddress(),
      );
      const [eventPda] = this.pdaService.deriveEventPDA(
        this.programId,
        authority,
        eventId,
      );

      const balance = await this.solanaTicketService.getEscrowBalance(eventPda);

      return {
        success: true,
        eventId,
        eventPda: eventPda.toBase58(),
        escrowBalance: balance,
        escrowBalanceUSDC: balance / 1_000_000, // Convert from scaled value
      };
    } catch (error) {
      this.logger.error('Error fetching escrow balance:', error);
      throw new NotFoundException(
        `Escrow not found: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
