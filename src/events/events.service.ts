import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThanOrEqual } from 'typeorm';
import { PublicKey } from '@solana/web3.js';
import { PdaService } from '../blockchain/services/pda.service';
import { SolanaService } from '../blockchain/services/solana.service';
import { SolanaTicketService } from '../blockchain/solana-ticket/solana-ticket.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { DistributeRoyaltyDto } from './dto/distribute-royalty.dto';
import { Event } from './entities/event.entity';
import { solanaConfig } from '../config/solana.config';
import type { ConfigType } from '@nestjs/config';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly programId: PublicKey;

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly solanaTicketService: SolanaTicketService,
    private readonly solanaService: SolanaService,
    private readonly pdaService: PdaService,
    @Inject(solanaConfig.KEY)
    config: ConfigType<typeof solanaConfig>,
  ) {
    this.programId = new PublicKey(config.programId);
  }

  /**
   * Create a new event (database only, blockchain initialization separate)
   */
  async createEvent(dto: CreateEventDto, partnerId: string) {
    try {
      this.logger.log(`Creating event: ${dto.eventId}`);

      // Check if eventId already exists
      const existing = await this.eventRepository.findOne({
        where: { eventId: dto.eventId },
      });

      if (existing) {
        throw new BadRequestException(
          `Event with ID ${dto.eventId} already exists`,
        );
      }

      // Validate royalty distribution
      const totalPercentage = dto.royaltyDistribution.reduce(
        (sum, partner) => sum + partner.percentage,
        0,
      );

      if (totalPercentage > 100) {
        throw new BadRequestException(
          `Total royalty percentage (${totalPercentage}%) exceeds 100%`,
        );
      }

      // Create event in database (not on blockchain yet)
      const event = this.eventRepository.create({
        eventId: dto.eventId,
        name: dto.name,
        description: dto.description,
        venue: dto.venue,
        eventDate: new Date(dto.eventDate),
        totalTickets: dto.totalTickets,
        ticketPrice: dto.ticketPrice,
        totalRoyaltyPercentage: totalPercentage,
        royaltyDistribution: dto.royaltyDistribution,
        partnerId,
        blockchainEnabled: false,
        blockchainEvents: [],
      });

      const savedEvent = await this.eventRepository.save(event);

      this.logger.log(
        `Event created successfully: ${savedEvent.id} (blockchain not initialized)`,
      );

      return savedEvent;
    } catch (error) {
      this.logger.error('Error creating event:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Initialize event on blockchain
   */
  async initializeBlockchain(eventId: string, userId: string) {
    try {
      this.logger.log(`Initializing blockchain for event: ${eventId}`);

      // Find event
      const event = await this.eventRepository.findOne({
        where: { id: eventId },
        relations: ['partner'],
      });

      if (!event) {
        throw new NotFoundException('Event not found');
      }

      // Verify ownership
      if (event.partnerId !== userId) {
        throw new BadRequestException(
          'You do not have permission to initialize this event',
        );
      }

      // Check if already initialized
      if (event.blockchainEnabled) {
        throw new BadRequestException(
          'Event already initialized on blockchain',
        );
      }

      // Generate royalty string for blockchain
      const royaltyString = event.royaltyDistribution
        .map((p) => p.percentage.toString())
        .join(',');

      // Initialize on blockchain
      const { signature, eventPda, eventKeypair } =
        await this.solanaTicketService.createEvent({
          eventId: event.eventId,
          name: event.name,
          royalty: royaltyString,
        });

      // Wait for confirmation
      const confirmed = await this.solanaService.waitForConfirmation(signature);

      if (!confirmed) {
        throw new InternalServerErrorException(
          'Transaction confirmation timeout',
        );
      }

      // Update event with blockchain data
      const blockchainEvents = event.blockchainEvents || [];
      blockchainEvents.push({
        eventType: 'event_init',
        txHash: signature,
        walletAddress: event.partner.walletAddress,
        eventData: {
          eventPda: eventPda.toBase58(),
        },
        timestamp: Date.now(),
      });

      await this.eventRepository.update(eventId, {
        blockchainEnabled: true,
        eventPda: eventPda.toBase58(),
        blockchainInitTxHash: signature,
        blockchainInitializedAt: new Date(),
        eventPublicKey: eventKeypair.publicKey,
        eventSecretKey: eventKeypair.privateKey, // TODO: Encrypt in production!
        blockchainEvents,
      });

      this.logger.log(
        `Blockchain initialized successfully for event: ${eventId}`,
      );

      return await this.eventRepository.findOne({ where: { id: eventId } });
    } catch (error) {
      this.logger.error('Error initializing blockchain:', error);

      // Log failure
      const event = await this.eventRepository.findOne({
        where: { id: eventId },
      });
      if (event) {
        const blockchainEvents = event.blockchainEvents || [];
        blockchainEvents.push({
          eventType: 'event_init_failed',
          eventData: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          timestamp: Date.now(),
        });
        await this.eventRepository.update(eventId, { blockchainEvents });
      }

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to initialize blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get event details by ID (database)
   */
  async findOne(eventId: string) {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['partner'],
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  /**
   * Get event details by business eventId
   */
  async findByEventId(eventId: string) {
    const event = await this.eventRepository.findOne({
      where: { eventId },
      relations: ['partner'],
    });

    if (!event) {
      throw new NotFoundException(`Event with eventId ${eventId} not found`);
    }

    return event;
  }

  /**
   * Get all events with filtering and pagination
   */
  async findAll(query: QueryEventsDto) {
    const {
      page = 1,
      limit = 10,
      partnerId,
      blockchainEnabled,
      upcoming,
      search,
    } = query;

    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.partner', 'partner')
      .where('event.deletedAt IS NULL'); // Exclude soft-deleted

    // Apply filters
    if (partnerId) {
      queryBuilder.andWhere('event.partnerId = :partnerId', { partnerId });
    }

    if (blockchainEnabled !== undefined) {
      queryBuilder.andWhere('event.blockchainEnabled = :blockchainEnabled', {
        blockchainEnabled,
      });
    }

    if (upcoming) {
      queryBuilder.andWhere('event.eventDate >= :now', { now: new Date() });
    }

    if (search) {
      queryBuilder.andWhere(
        '(event.name ILIKE :search OR event.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Ordering
    queryBuilder.orderBy('event.eventDate', 'DESC');

    const [events, total] = await queryBuilder.getManyAndCount();

    return {
      data: events,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update event details (only allowed fields)
   */
  async update(eventId: string, dto: UpdateEventDto, userId: string) {
    const event = await this.findOne(eventId);

    // Verify ownership
    if (event.partnerId !== userId) {
      throw new BadRequestException(
        'You do not have permission to update this event',
      );
    }

    // If blockchain is enabled, only allow updating description and venue
    if (event.blockchainEnabled) {
      const { name, eventDate, ...allowedFields } = dto;
      if (name || eventDate) {
        throw new BadRequestException(
          'Cannot update name or eventDate for blockchain-enabled events',
        );
      }
      Object.assign(event, allowedFields);
    } else {
      // Before blockchain initialization, allow updating everything except eventId
      Object.assign(event, dto);
      if (dto.eventDate) {
        event.eventDate = new Date(dto.eventDate);
      }
    }

    return await this.eventRepository.save(event);
  }

  /**
   * Soft delete event
   */
  async remove(eventId: string, userId: string) {
    const event = await this.findOne(eventId);

    // Verify ownership
    if (event.partnerId !== userId) {
      throw new BadRequestException(
        'You do not have permission to delete this event',
      );
    }

    // Cannot delete blockchain-enabled events
    if (event.blockchainEnabled) {
      throw new BadRequestException(
        'Cannot delete blockchain-enabled events. Contact support for assistance.',
      );
    }

    // TODO: Check if any tickets sold before allowing deletion

    await this.eventRepository.softRemove(event);

    return { success: true, message: 'Event deleted successfully' };
  }

  /**
   * Get event statistics
   */
  async getStats(eventId: string, userId: string) {
    const event = await this.findOne(eventId);

    // Verify ownership
    if (event.partnerId !== userId) {
      throw new BadRequestException(
        'You do not have permission to view this event stats',
      );
    }

    const stats: any = {
      eventId: event.eventId,
      name: event.name,
      totalTickets: event.totalTickets,
      ticketsSold: 0,
      ticketsRemaining: event.totalTickets,
      revenue: 0,
      blockchainEnabled: event.blockchainEnabled,
    };

    // If blockchain is enabled, fetch on-chain data
    if (event.blockchainEnabled && event.eventPda) {
      try {
        const eventPda = new PublicKey(event.eventPda);
        const eventData =
          await this.solanaTicketService.getEventAccount(eventPda);

        if (eventData) {
          stats.ticketsSold = eventData.ticketsSold;
          stats.ticketsRemaining = event.totalTickets - eventData.ticketsSold;
          stats.revenue = eventData.ticketsSold * event.ticketPrice;
          stats.onChainData = {
            isActive: eventData.isActive,
            royaltyDistributed: eventData.royaltyDistributed,
          };
        }

        // Get escrow balance
        const escrowBalance =
          await this.solanaTicketService.getEscrowBalance(eventPda);
        stats.escrowBalance = escrowBalance;
        stats.escrowBalanceUSDC = escrowBalance / 1_000_000;
      } catch (error) {
        this.logger.warn(`Failed to fetch blockchain stats: ${error}`);
      }
    }

    return stats;
  }

  /**
   * Distribute royalties for an event
   */
  async distributeRoyalty(
    eventId: string,
    dto: DistributeRoyaltyDto,
    userId: string,
  ) {
    try {
      this.logger.log(`Distributing royalties for event: ${eventId}`);

      const event = await this.findOne(eventId);

      // Verify ownership
      if (event.partnerId !== userId) {
        throw new BadRequestException(
          'You do not have permission to distribute royalties for this event',
        );
      }

      // Check if blockchain is enabled
      if (!event.blockchainEnabled || !event.eventPda) {
        throw new BadRequestException('Event not initialized on blockchain');
      }

      const eventPda = new PublicKey(event.eventPda);
      const authority = new PublicKey(dto.authority);

      // Check if event exists on-chain
      const eventData =
        await this.solanaTicketService.getEventAccount(eventPda);
      if (!eventData) {
        throw new NotFoundException(`Event not found on blockchain`);
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
        throw new InternalServerErrorException(
          'Transaction confirmation timeout',
        );
      }

      // Log distribution event
      const blockchainEvents = event.blockchainEvents || [];
      blockchainEvents.push({
        eventType: 'royalty_distributed',
        txHash: signature,
        walletAddress: dto.authority,
        eventData: {
          totalAmount: escrowBalance,
          partyAddresses: dto.partyAddresses,
          distributedAmounts,
        },
        timestamp: Date.now(),
      });

      await this.eventRepository.update(eventId, { blockchainEvents });

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
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to distribute royalties: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get escrow balance for an event
   */
  async getEscrowBalance(eventId: string, userId: string) {
    try {
      const event = await this.findOne(eventId);

      // Verify ownership
      if (event.partnerId !== userId) {
        throw new BadRequestException(
          'You do not have permission to view escrow balance for this event',
        );
      }

      // Check if blockchain is enabled
      if (!event.blockchainEnabled || !event.eventPda) {
        throw new BadRequestException('Event not initialized on blockchain');
      }

      const eventPda = new PublicKey(event.eventPda);
      const balance = await this.solanaTicketService.getEscrowBalance(eventPda);

      return {
        success: true,
        eventId: event.eventId,
        eventPda: eventPda.toBase58(),
        escrowBalance: balance,
        escrowBalanceUSDC: balance / 1_000_000, // Convert from scaled value
      };
    } catch (error) {
      this.logger.error('Error fetching escrow balance:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new NotFoundException(
        `Escrow not found: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
