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
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { solanaConfig } from '../config/solana.config';
import type { ConfigType } from '@nestjs/config';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { usdToMicroUsdc, microUsdcToUsd } from '../blockchain/utils/currency.utils';
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
      // Convert USD prices to micro-USDC for blockchain
      const { signature, ticketPda, resellCount } =
        await this.solanaTicketService.resellTicket({
          eventPda,
          ticketId: dto.ticketId,
          sellerId: dto.sellerId,
          buyerId: dto.buyerId,
          price: usdToMicroUsdc(dto.newPrice),
          originalPrice: usdToMicroUsdc(dto.originalPrice),
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
  async getEventTickets(eventId: string, filters?: QueryTicketsDto) {
    try {
      // Derive event PDA
      const [eventPda] = this.pdaService.deriveEventPDA(
        this.programId,
        eventId,
      );

      // Fetch all tickets from blockchain
      const tickets = await this.solanaTicketService.getEventTickets(eventPda);

      // Get database tickets for additional filtering
      let dbTickets = await this.ticketRepository.find({
        where: { eventId },
      });

      // Apply filters if provided
      if (filters) {
        if (filters.status) {
          dbTickets = dbTickets.filter((t) => t.status === filters.status);
        }
        if (filters.minPrice !== undefined) {
          dbTickets = dbTickets.filter(
            (t) => parseFloat(t.currentPrice.toString()) >= filters.minPrice!,
          );
        }
        if (filters.maxPrice !== undefined) {
          dbTickets = dbTickets.filter(
            (t) => parseFloat(t.currentPrice.toString()) <= filters.maxPrice!,
          );
        }
        if (filters.maxResellCount !== undefined) {
          dbTickets = dbTickets.filter(
            (t) => t.resellCount <= filters.maxResellCount!,
          );
        }
        if (filters.owner) {
          dbTickets = dbTickets.filter((t) => t.currentOwner === filters.owner);
        }
      }

      // Filter blockchain tickets to match database results
      const filteredTicketIds = new Set(dbTickets.map((t) => t.ticketId));
      const filteredBlockchainTickets = tickets.filter((t) =>
        filteredTicketIds.has(t.ticketId),
      );

      return {
        success: true,
        eventId,
        eventPda: eventPda.toBase58(),
        totalTickets: filteredBlockchainTickets.length,
        filters: filters || {},
        tickets: filteredBlockchainTickets.map((ticket) => ({
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

  /**
   * Get tickets by wallet address across all events
   */
  async getTicketsByWallet(walletAddress: string) {
    try {
      this.logger.log(`Fetching tickets for wallet: ${walletAddress}`);

      // Get all tickets owned by this wallet from database
      const tickets = await this.ticketRepository.find({
        where: { currentOwner: walletAddress },
        relations: ['event'],
        order: { createdAt: 'DESC' },
      });

      // Group tickets by event
      const ticketsByEvent = tickets.reduce(
        (acc, ticket) => {
          const eventId = ticket.eventId;
          if (!acc[eventId]) {
            acc[eventId] = {
              eventId,
              eventName: ticket.event?.name || 'Unknown Event',
              tickets: [],
            };
          }
          acc[eventId].tickets.push({
            ticketId: ticket.ticketId,
            ticketPda: ticket.ticketPda,
            currentPrice: parseFloat(ticket.currentPrice.toString()),
            originalPrice: parseFloat(ticket.originalPrice.toString()),
            resellCount: ticket.resellCount,
            status: ticket.status,
            purchaseDate: ticket.purchaseDate,
          });
          return acc;
        },
        {} as Record<string, any>,
      );

      // Calculate portfolio statistics
      const totalTickets = tickets.length;
      const totalValue = tickets.reduce(
        (sum, t) => sum + parseFloat(t.currentPrice.toString()),
        0,
      );
      const totalInvested = tickets.reduce(
        (sum, t) => sum + parseFloat(t.originalPrice.toString()),
        0,
      );
      const activeTickets = tickets.filter((t) => t.status === 'active').length;
      const usedTickets = tickets.filter((t) => t.status === 'used').length;

      return {
        success: true,
        walletAddress,
        portfolio: {
          totalTickets,
          activeTickets,
          usedTickets,
          totalValue,
          totalInvested,
          unrealizedGainLoss: totalValue - totalInvested,
          unrealizedGainLossPercentage:
            totalInvested > 0
              ? ((totalValue - totalInvested) / totalInvested) * 100
              : 0,
        },
        events: Object.values(ticketsByEvent),
      };
    } catch (error) {
      this.logger.error('Error fetching tickets by wallet:', error);
      throw new BadRequestException(
        `Failed to fetch tickets: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get available tickets for an event (unsold or listed for resale)
   */
  async getAvailableTickets(eventId: string) {
    try {
      this.logger.log(`Fetching available tickets for event: ${eventId}`);

      // Get event details
      const event = await this.eventsService.findOne(eventId);

      if (!event.blockchainEnabled || !event.eventPda) {
        throw new BadRequestException('Event not initialized on blockchain');
      }

      const eventPda = new PublicKey(event.eventPda);

      // Get event data from blockchain
      const eventData =
        await this.solanaTicketService.getEventAccount(eventPda);

      if (!eventData) {
        throw new NotFoundException('Event not found on blockchain');
      }

      // Validate event data
      if (!event.totalTickets || !event.ticketPrice) {
        throw new BadRequestException(
          'Event missing required ticket information',
        );
      }

      // Calculate available tickets
      const totalTickets = event.totalTickets;
      const soldTickets = eventData.ticketsSold;
      const availableCount = totalTickets - soldTickets;
      const originalPrice = parseFloat(event.ticketPrice.toString());

      // Get all sold tickets from database
      const soldTicketsList = await this.ticketRepository.find({
        where: { eventId: event.eventId },
        order: { currentPrice: 'ASC' },
      });

      // For marketplace, show active tickets that could be resold
      const activeTickets = soldTicketsList
        .filter((t) => t.status === 'active')
        .map((t) => ({
          ticketId: t.ticketId,
          ticketPda: t.ticketPda,
          currentOwner: t.currentOwner,
          currentPrice: parseFloat(t.currentPrice.toString()),
          originalPrice: parseFloat(t.originalPrice.toString()),
          resellCount: t.resellCount,
          priceAppreciation:
            ((parseFloat(t.currentPrice.toString()) -
              parseFloat(t.originalPrice.toString())) /
              parseFloat(t.originalPrice.toString())) *
            100,
        }));

      return {
        success: true,
        eventId: event.eventId,
        eventName: event.name,
        availability: {
          totalTickets,
          soldTickets,
          unsoldTickets: availableCount,
          availabilityPercentage: (availableCount / totalTickets) * 100,
          originalPrice,
        },
        marketplace: {
          activeListings: activeTickets.length,
          lowestPrice:
            activeTickets.length > 0
              ? Math.min(...activeTickets.map((t) => t.currentPrice))
              : originalPrice,
          highestPrice:
            activeTickets.length > 0
              ? Math.max(...activeTickets.map((t) => t.currentPrice))
              : originalPrice,
          averagePrice:
            activeTickets.length > 0
              ? activeTickets.reduce((sum, t) => sum + t.currentPrice, 0) /
                activeTickets.length
              : originalPrice,
          tickets: activeTickets,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching available tickets:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch available tickets: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
