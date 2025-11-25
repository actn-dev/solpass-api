import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { PdaService } from '../blockchain/services/pda.service';
import { SolanaService } from '../blockchain/services/solana.service';
import { SolanaTicketService } from '../blockchain/solana-ticket/solana-ticket.service';
import { solanaConfig } from '../config/solana.config';
import { CreateEventDto } from './dto/create-event.dto';
import { DistributeRoyaltyDto } from './dto/distribute-royalty.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from './entities/event.entity';

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
   * Sanitize event data by removing sensitive fields
   */
  private sanitizeEvent(event: Event): Partial<Event> {
    const { eventSecretKey, ...sanitized } = event;

    // Remove sensitive partner data if loaded
    if (sanitized.partner) {
      const { password, apiKey, ...partnerData } = sanitized.partner as any;
      sanitized.partner = partnerData as User;
    }

    return sanitized;
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

      return this.sanitizeEvent(savedEvent);
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
        where: { eventId: eventId },
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

      await this.eventRepository.update(event.id, {
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

      const updatedEvent = await this.eventRepository.findOne({
        where: { id: event.eventId },
      });
      return updatedEvent ? this.sanitizeEvent(updatedEvent) : null;
    } catch (error) {
      this.logger.error('Error initializing blockchain:', error);

      // Log failure
      const event = await this.eventRepository.findOne({
        where: { eventId: eventId },
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
        await this.eventRepository.update(event.id, { blockchainEvents });
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
      where: { eventId: eventId },
      relations: ['partner'],
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return this.sanitizeEvent(event);
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

    return this.sanitizeEvent(event);
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
      data: events.map((event) => this.sanitizeEvent(event)),
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
    const event = await this.eventRepository.findOneOrFail({
      where: { eventId },
    });

    // Verify ownership
    if (event.partnerId !== userId) {
      throw new BadRequestException(
        'You do not have permission to update this event',
      );
    }

    // If blockchain is enabled, restrict updates
    if (event.blockchainEnabled) {
      const { name, eventDate, royaltyDistribution, ...allowedFields } = dto;

      // Cannot update name or eventDate after blockchain init
      if (name || eventDate) {
        throw new BadRequestException(
          'Cannot update name or eventDate for blockchain-enabled events',
        );
      }

      // Allow royaltyDistribution updates only for wallet addresses
      if (royaltyDistribution) {
        if (
          !event.royaltyDistribution ||
          event.royaltyDistribution.length === 0
        ) {
          throw new BadRequestException('Event has no partners configured');
        }

        // Update wallet addresses based on party name matching
        for (const update of royaltyDistribution) {
          const existingPartner = event.royaltyDistribution.find(
            (p) => p.partyName === update.partyName,
          );

          if (!existingPartner) {
            throw new BadRequestException(
              `Partner '${update.partyName}' not found in event configuration`,
            );
          }

          // Update only the wallet address
          existingPartner.walletAddress = update.walletAddress;
        }
      }

      // Apply other allowed fields (description, venue)
      Object.assign(event, allowedFields);
    } else {
      // Before blockchain initialization, allow updating everything except eventId
      Object.assign(event, dto);
      if (dto.eventDate) {
        event.eventDate = new Date(dto.eventDate);
      }
    }

    const savedEvent = await this.eventRepository.save(event);
    return this.sanitizeEvent(savedEvent);
  }

  /**
   * Soft delete event
   */
  async remove(eventId: string, userId: string) {
    const event = await this.eventRepository.findOneOrFail({
      where: { eventId },
    });

    // Verify ownership
    if (event.partnerId !== userId) {
      throw new BadRequestException(
        'You do not have permission to delete this event',
      );
    }

    // Cannot delete events that have been initialized on blockchain
    if (event.blockchainInitializedAt || event.blockchainEnabled) {
      throw new BadRequestException(
        'Cannot delete blockchain-initialized events. The event has been recorded on-chain and cannot be removed. Contact support if you need to deactivate this event.',
      );
    }

    // Check if any tickets exist (even if blockchain not initialized)
    if (event.blockchainEnabled && event.eventPda) {
      try {
        const eventPda = new PublicKey(event.eventPda);
        const tickets =
          await this.solanaTicketService.getEventTickets(eventPda);

        if (tickets.length > 0) {
          throw new BadRequestException(
            `Cannot delete event with ${tickets.length} ticket(s) sold. Contact support for assistance.`,
          );
        }
      } catch (error) {
        // If we can't check tickets, still block deletion if blockchain was enabled
        this.logger.warn(
          `Could not check tickets for event ${eventId}: ${error}`,
        );
      }
    }

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
      tickets: [],
    };

    // If blockchain is enabled, fetch on-chain data
    if (event.blockchainEnabled && event.eventPda) {
      try {
        const eventPda = new PublicKey(event.eventPda);
        const eventData =
          await this.solanaTicketService.getEventAccount(eventPda);

        if (eventData) {
          stats.ticketsSold = eventData.ticketsSold;
          stats.ticketsRemaining =
            event.totalTickets ?? 0 - eventData.ticketsSold;
          stats.onChainData = {
            isActive: eventData.isActive,
            royaltyDistributed: eventData.royaltyDistributed,
            authority: eventData.authority.toBase58(),
          };
        }

        // Get all tickets from blockchain
        const tickets =
          await this.solanaTicketService.getEventTickets(eventPda);

        // Calculate total revenue from actual ticket prices
        let totalRevenue = 0;
        stats.tickets = tickets.map((ticket) => {
          totalRevenue += ticket.ticketPrice || 0;
          return {
            ticketId: ticket.ticketId,
            owner: ticket.owner,
            seller: ticket.seller,
            currentPrice: ticket.ticketPrice,
            resellCount: ticket.resellCount,
            purchaseDate: ticket.purchaseDate,
          };
        });

        stats.revenue = totalRevenue;
        stats.averageTicketPrice =
          tickets.length > 0 ? totalRevenue / tickets.length : 0;

        // Get escrow balance (royalties collected)
        const escrowBalance =
          await this.solanaTicketService.getEscrowBalance(eventPda);
        stats.escrowBalance = escrowBalance;
        stats.escrowBalanceUSDC = escrowBalance / 1_000_000;
        stats.totalRoyaltiesCollected = stats.escrowBalanceUSDC;
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

      // Extract party wallet addresses from royaltyDistribution
      if (
        !event.royaltyDistribution ||
        event.royaltyDistribution.length === 0
      ) {
        throw new BadRequestException(
          'No royalty partners configured for this event',
        );
      }

      const partyWalletAddresses: string[] = [];
      const partnersWithoutWallets: string[] = [];

      for (const partner of event.royaltyDistribution) {
        if (!partner.walletAddress) {
          partnersWithoutWallets.push(partner.partyName);
        } else {
          partyWalletAddresses.push(partner.walletAddress);
        }
      }

      if (partnersWithoutWallets.length > 0) {
        throw new BadRequestException(
          `Partners missing wallet addresses: ${partnersWithoutWallets.join(', ')}`,
        );
      }

      this.logger.log(`Party wallets: ${partyWalletAddresses.join(', ')}`);

      // Validate all partners have USDC accounts
      const validation =
        await this.validatePartyUsdcAccounts(partyWalletAddresses);

      if (!validation.valid) {
        throw new BadRequestException(
          `The following partners do not have USDC token accounts: ${validation.missingAccounts
            .map((addr) => {
              const partner = event.royaltyDistribution?.find(
                (p) => p.walletAddress === addr,
              );
              return `${partner?.partyName || 'Unknown'} (${addr})`;
            })
            .join(
              ', ',
            )}. Please enable USDC accounts first using POST /events/${eventId ?? 'd'}/enable-partner-usdc`,
        );
      }

      const eventPda = new PublicKey(event.eventPda);

      // Check if event exists on-chain
      const eventData =
        await this.solanaTicketService.getEventAccount(eventPda);
      if (!eventData) {
        throw new NotFoundException(`Event not found on blockchain`);
      }

      // Check if already distributed
      if (eventData.royaltyDistributed) {
        throw new BadRequestException(
          'Royalties already distributed for this event',
        );
      }

      // Parse and validate royalty percentages match partner count
      const royaltyPercentages = eventData.royalty
        .split(',')
        .map((pct: string) => parseInt(pct.trim()))
        .filter((pct: number) => !isNaN(pct));

      if (royaltyPercentages.length !== partyWalletAddresses.length) {
        throw new BadRequestException(
          `Royalty distribution mismatch: ${royaltyPercentages.length} percentages on-chain but ${partyWalletAddresses.length} partners in database`,
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

      // Call blockchain service - use server wallet as authority (it created the event)
      const { signature, distributedAmounts } =
        await this.solanaTicketService.distributeRoyalty({
          eventPda,
          authority: eventData.authority, // Use the authority from on-chain event
          partyWalletAddresses,
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
        walletAddress: eventData.authority.toBase58(),
        eventData: {
          totalAmount: escrowBalance,
          partyAddresses: partyWalletAddresses,
          distributedAmounts,
        },
        timestamp: Date.now(),
      });

      const event_id = event.id;

      if (!event_id)
        throw new InternalServerErrorException('Event ID is missing');

      await this.eventRepository.update(event_id, { blockchainEvents });

      return {
        success: true,
        transactionSignature: signature,
        eventPda: eventPda.toBase58(),
        distribution: {
          totalAmount: escrowBalance,
          partyAddresses: partyWalletAddresses,
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
   * Validate that all party wallets have USDC token accounts
   */
  private async validatePartyUsdcAccounts(
    walletAddresses: string[],
  ): Promise<{ valid: boolean; missingAccounts: string[] }> {
    const missingAccounts: string[] = [];

    for (const address of walletAddresses) {
      try {
        const walletPubkey = new PublicKey(address);
        const hasAccount =
          await this.solanaTicketService.checkUsdcAccountExists(walletPubkey);

        if (!hasAccount) {
          missingAccounts.push(address);
        }
      } catch (error) {
        this.logger.error(
          `Error checking USDC account for ${address}: ${error}`,
        );
        missingAccounts.push(address);
      }
    }

    return {
      valid: missingAccounts.length === 0,
      missingAccounts,
    };
  }

  /**
   * Enable USDC token accounts for all partners of an event
   */
  async enablePartnerUsdcAccounts(eventId: string, userId: string) {
    try {
      this.logger.log(`Enabling partner USDC accounts for event: ${eventId}`);

      const event = await this.findOne(eventId);

      // Verify ownership
      if (event.partnerId !== userId) {
        throw new BadRequestException(
          'You do not have permission to manage this event',
        );
      }

      if (
        !event.royaltyDistribution ||
        event.royaltyDistribution.length === 0
      ) {
        throw new BadRequestException(
          'No royalty partners configured for this event',
        );
      }

      // Extract wallet addresses
      const partnersWithoutWallets: string[] = [];
      const partnersToEnable: Array<{
        partyName: string;
        walletAddress: string;
      }> = [];

      for (const partner of event.royaltyDistribution) {
        if (!partner.walletAddress) {
          partnersWithoutWallets.push(partner.partyName);
        } else {
          partnersToEnable.push({
            partyName: partner.partyName,
            walletAddress: partner.walletAddress,
          });
        }
      }

      if (partnersWithoutWallets.length > 0) {
        throw new BadRequestException(
          `Partners missing wallet addresses: ${partnersWithoutWallets.join(', ')}. Please update partner wallet addresses first.`,
        );
      }

      // Enable USDC accounts for each partner
      const results: Array<{
        partyName: string;
        walletAddress: string;
        success: boolean;
        accountAddress?: string;
        created?: boolean;
        transactionSignature?: string;
        error?: string;
      }> = [];

      for (const partner of partnersToEnable) {
        try {
          const walletPubkey = new PublicKey(partner.walletAddress);
          const result =
            await this.solanaTicketService.createUsdcAccountIfNeeded(
              walletPubkey,
            );

          results.push({
            partyName: partner.partyName,
            walletAddress: partner.walletAddress,
            ...result,
          });
        } catch (error) {
          results.push({
            partyName: partner.partyName,
            walletAddress: partner.walletAddress,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.length - successCount;

      return {
        success: failedCount === 0,
        message: `Successfully enabled ${successCount}/${results.length} USDC accounts`,
        results,
      };
    } catch (error) {
      this.logger.error('Error enabling partner USDC accounts:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to enable USDC accounts: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
