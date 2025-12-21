import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PublicKey } from '@solana/web3.js';
import { PdaService } from '../blockchain/services/pda.service';
import { SolanaService } from '../blockchain/services/solana.service';
import { SolanaTicketService } from '../blockchain/solana-ticket/solana-ticket.service';
import { EventsService } from '../events/events.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { solanaConfig } from '../config/solana.config';
import type { ConfigType } from '@nestjs/config';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import {
  TicketTransaction,
  TransactionType,
  TransactionStatus,
} from './entities/ticket-transaction.entity';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly programId: PublicKey;

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(TicketTransaction)
    private readonly ticketTransactionRepository: Repository<TicketTransaction>,
    private readonly solanaTicketService: SolanaTicketService,
    private readonly solanaService: SolanaService,
    private readonly pdaService: PdaService,
    private readonly eventsService: EventsService,
    @Inject(solanaConfig.KEY)
    config: ConfigType<typeof solanaConfig>,
  ) {
    this.programId = new PublicKey(config.programId);
  }

  /**
   * Purchase or resell a ticket
   */
  async purchaseTicket(eventId: string, dto: CreateTicketDto) {
    try {
      this.logger.log(
        `Processing ticket purchase: ${dto.ticketId} for event: ${eventId}`,
      );

      // Derive event PDA
      const [eventPda] = this.pdaService.deriveEventPDA(
        this.programId,
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

      // Verify ticket ownership before resell
      const ownershipCheck =
        await this.solanaTicketService.verifyTicketOwnership(
          eventPda,
          dto.ticketId,
          dto.sellerId,
        );

      if (!ownershipCheck.isValid) {
        throw new BadRequestException(
          `Ticket ownership verification failed. Current owner: ${ownershipCheck.currentOwner}, Claimed seller: ${dto.sellerId}`,
        );
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

      // Save to database after blockchain confirmation
      await this.saveTicketToDatabase(
        eventId,
        dto,
        ticketPda.toBase58(),
        signature,
        resellCount,
        ticketData,
      );

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
   * Save ticket and transaction to database
   */
  private async saveTicketToDatabase(
    eventId: string,
    dto: CreateTicketDto,
    ticketPda: string,
    txHash: string,
    resellCount: number,
    ticketData: any,
  ) {
    try {
      // Check if ticket already exists
      let ticket = await this.ticketRepository.findOne({
        where: { ticketId: dto.ticketId, eventId },
      });

      const isFirstPurchase = !ticket;
      const fromOwner = ticket?.currentOwner || undefined;

      if (ticket) {
        // Update existing ticket
        ticket.currentOwner = dto.buyerId;
        ticket.currentPrice = dto.newPrice;
        ticket.resellCount = resellCount;
        ticket.purchaseDate = ticketData?.purchaseDate
          ? new Date(ticketData.purchaseDate * 1000)
          : new Date();
      } else {
        // Create new ticket
        ticket = this.ticketRepository.create({
          ticketId: dto.ticketId,
          eventId,
          currentOwner: dto.buyerId,
          currentPrice: dto.newPrice,
          originalPrice: dto.originalPrice,
          resellCount,
          ticketPda,
          status: TicketStatus.ACTIVE,
          purchaseDate: ticketData?.purchaseDate
            ? new Date(ticketData.purchaseDate * 1000)
            : new Date(),
        });
      }

      await this.ticketRepository.save(ticket);

      // Create transaction record
      const transaction = this.ticketTransactionRepository.create({
        ticketId: dto.ticketId,
        eventId,
        fromOwner,
        toOwner: dto.buyerId,
        price: dto.newPrice,
        transactionType: isFirstPurchase
          ? TransactionType.PURCHASE
          : TransactionType.RESELL,
        blockchainTxHash: txHash,
        blockchainTxStatus: TransactionStatus.CONFIRMED,
        metadata: {
          eventId,
          buyerWallet: dto.buyerWallet,
          sellerWallet: dto.sellerWallet,
          ticketPda,
        },
      });

      await this.ticketTransactionRepository.save(transaction);

      this.logger.log(
        `Saved ticket ${dto.ticketId} and transaction to database`,
      );
    } catch (error) {
      this.logger.error('Error saving ticket to database:', error);
      // Don't throw - blockchain transaction already succeeded
    }
  }

  /**
   * Get ticket transaction history
   */
  async getTicketHistory(eventId: string, ticketId: string) {
    try {
      const transactions = await this.ticketTransactionRepository.find({
        where: { ticketId, eventId },
        order: { createdAt: 'ASC' },
      });

      if (transactions.length === 0) {
        throw new NotFoundException(
          `No transaction history found for ticket ${ticketId}`,
        );
      }

      return {
        success: true,
        ticketId,
        eventId,
        totalTransactions: transactions.length,
        history: transactions.map((tx) => ({
          id: tx.id,
          fromOwner: tx.fromOwner,
          toOwner: tx.toOwner,
          price: tx.price,
          transactionType: tx.transactionType,
          blockchainTxHash: tx.blockchainTxHash,
          status: tx.blockchainTxStatus,
          date: tx.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error('Error fetching ticket history:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch ticket history: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get ticket details
   */
  async getTicket(eventId: string, ticketId: string) {
    try {
      // Derive event PDA
      const [eventPda] = this.pdaService.deriveEventPDA(
        this.programId,
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
          purchaseDate: new Date(ticketData.purchaseDate * 1000).toISOString(),
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
   * Get all tickets for an event from blockchain
   */
  async getEventTickets(eventId: string) {
    try {
      // Derive event PDA
      const [eventPda] = this.pdaService.deriveEventPDA(
        this.programId,
        eventId,
      );

      // Fetch all tickets from blockchain
      const tickets = await this.solanaTicketService.getEventTickets(eventPda);

      return {
        success: true,
        eventId,
        eventPda: eventPda.toBase58(),
        totalTickets: tickets.length,
        tickets: tickets.map((ticket) => ({
          ticketPda: ticket.publicKey,
          ticketId: ticket.ticketId,
          owner: ticket.owner,
          seller: ticket.seller,
          ticketPrice: ticket.ticketPrice,
          resellCount: ticket.resellCount,
          purchaseDate: new Date(ticket.purchaseDate * 1000).toISOString(),
        })),
      };
    } catch (error) {
      this.logger.error('Error fetching event tickets:', error);
      throw new BadRequestException(
        `Failed to fetch tickets: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
