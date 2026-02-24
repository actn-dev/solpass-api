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
import { PublicKey, Keypair } from '@solana/web3.js';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
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
import { DailyAnalyticsDto } from './dto/daily-analytics.dto';
import { Event } from './entities/event.entity';
import { TicketTransaction } from '../tickets/entities/ticket-transaction.entity';
import { Ticket } from '../tickets/entities/ticket.entity';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly programId: PublicKey;

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(TicketTransaction)
    private readonly ticketTransactionRepository: Repository<TicketTransaction>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
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
        distributionThreshold: dto.distributionThreshold,
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

      // Build party wallet public keys from royalty distribution
      const partyWallets = event.royaltyDistribution.map(
        (p) => new PublicKey(p.walletAddress),
      );

      if (!event.distributionThreshold || event.distributionThreshold < 1) {
        throw new BadRequestException(
          'Event must have a valid distributionThreshold (>= 1)',
        );
      }

      if (event.distributionThreshold > partyWallets.length) {
        throw new BadRequestException(
          `distributionThreshold (${event.distributionThreshold}) cannot exceed the number of parties (${partyWallets.length})`,
        );
      }

      // Initialize on blockchain
      const { signature, eventPda, eventKeypair } =
        await this.solanaTicketService.createEvent({
          eventId: event.eventId,
          name: event.name,
          royalty: royaltyString,
          partyWallets,
          distributionThreshold: event.distributionThreshold,
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
        where: { eventId: eventId },
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

        stats.tickets = tickets.map((ticket) => {
          return {
            ticketId: ticket.ticketId,
            owner: ticket.owner,
            seller: ticket.seller,
            currentPrice: ticket.ticketPrice,
            resellCount: ticket.resellCount,
            purchaseDate: ticket.purchaseDate,
          };
        });

        // ✅ Get escrow balance as source of truth for distributable revenue
        const escrowBalance =
          await this.solanaTicketService.getEscrowBalance(eventPda);
        
        stats.revenue = escrowBalance; // Real distributable revenue
        stats.totalRevenue = escrowBalance;
        stats.escrowBalance = escrowBalance;
        stats.escrowBalanceUSDC = escrowBalance;
        stats.totalRoyaltiesCollected = escrowBalance;

        // Calculate average based on tickets sold
        stats.averageTicketPrice =
          tickets.length > 0
            ? tickets.reduce((sum, t) => sum + (t.ticketPrice || 0), 0) /
              tickets.length
            : 0;

        // Calculate partner's share if this is the partner viewing
        if (userId === event.partnerId && event.royaltyDistribution) {
          // Sum all partner shares (or show first partner's share)
          const totalPartnerPercentage = event.royaltyDistribution.reduce(
            (sum, p) => sum + p.percentage,
            0,
          );
          stats.partnerRevenue =
            (escrowBalance * totalPartnerPercentage) / 100;
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch blockchain stats: ${error}`);
      }
    }

    return stats;
  }

  /**
   * Get multi-sig approval status for royalty distribution
   */
  async getApprovalStatus(eventId: string) {
    try {
      const event = await this.findOne(eventId);

      if (!event.blockchainEnabled || !event.eventPda) {
        return {
          blockchainEnabled: false,
          message: 'Event not initialized on blockchain',
        };
      }

      const eventPda = new PublicKey(event.eventPda);

      // Fetch on-chain event + approval accounts in parallel
      const [eventData, approvalData, escrowBalance] = await Promise.all([
        this.solanaTicketService.getEventAccount(eventPda),
        this.solanaTicketService.getApprovalAccount(eventPda),
        this.solanaTicketService.getEscrowBalance(eventPda),
      ]);

      const threshold = event.distributionThreshold ?? 1;
      const approvedPubkeys: string[] =
        approvalData?.approvals?.map((pk: any) => pk.toBase58()) ?? [];
      const royaltyDistributed =
        eventData?.royaltyDistributed ?? false;
      const executed = approvalData?.executed ?? false;
      const canDistribute =
        approvedPubkeys.length >= threshold && !royaltyDistributed && !executed;

      // Enrich with partner names + approval status
      const parties = (event.royaltyDistribution ?? []).map((p) => ({
        partyName: p.partyName,
        walletAddress: p.walletAddress,
        percentage: p.percentage,
        approved: approvedPubkeys.includes(p.walletAddress),
      }));

      return {
        blockchainEnabled: true,
        threshold,
        totalParties: parties.length,
        approvedCount: approvedPubkeys.length,
        approvedPubkeys,
        canDistribute,
        royaltyDistributed,
        executed,
        escrowBalance,
        parties,
      };
    } catch (error) {
      this.logger.error('Error fetching approval status:', error);
      throw new BadRequestException(
        `Failed to fetch approval status: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Approve royalty distribution for an event (multi-sig)
   * The caller provides the signer's private key (base58). In production this
   * would be replaced by a proper wallet-signing flow on the partner's side.
   */
  async approveDistribution(
    eventId: string,
    signerPrivateKeyBase58: string,
    userId: string,
  ) {
    try {
      this.logger.log(`Approving distribution for event: ${eventId}`);

      const event = await this.findOne(eventId);

      if (!event.blockchainEnabled || !event.eventPda) {
        throw new BadRequestException('Event not initialized on blockchain');
      }

      // Reconstruct signer keypair from provided private key
      let signerKeypair: Keypair;
      try {
        const secretKey = bs58.decode(signerPrivateKeyBase58);
        signerKeypair = Keypair.fromSecretKey(secretKey);
      } catch {
        throw new BadRequestException('Invalid signer private key (expected base58-encoded secret key)');
      }

      const signerPublicKey = signerKeypair.publicKey.toBase58();

      // Verify the signer is one of the registered party wallets
      const isParty = event.royaltyDistribution?.some(
        (p) => p.walletAddress === signerPublicKey,
      );
      if (!isParty) {
        throw new BadRequestException(
          `Wallet ${signerPublicKey} is not a registered royalty partner for this event`,
        );
      }

      const eventPda = new PublicKey(event.eventPda);

      const { signature, approvalPda } =
        await this.solanaTicketService.approveDistribution({
          eventPda,
          signerKeypair,
        });

      const confirmed = await this.solanaService.waitForConfirmation(signature);
      if (!confirmed) {
        throw new InternalServerErrorException('Transaction confirmation timeout');
      }

      // Fetch updated approval state
      const approvalData =
        await this.solanaTicketService.getApprovalAccount(eventPda);

      // Log it
      const blockchainEvents = event.blockchainEvents || [];
      blockchainEvents.push({
        eventType: 'distribution_approved',
        txHash: signature,
        walletAddress: signerPublicKey,
        eventData: {
          approvalPda: approvalPda.toBase58(),
          totalApprovals: approvalData?.approvals?.length ?? '?',
          executed: approvalData?.executed ?? false,
        },
        timestamp: Date.now(),
      });
      if (!event.id) throw new InternalServerErrorException('Event ID is missing');
      await this.eventRepository.update(event.id, { blockchainEvents });

      return {
        success: true,
        transactionSignature: signature,
        signerPublicKey,
        totalApprovals: approvalData?.approvals?.length ?? null,
        executed: approvalData?.executed ?? false,
      };
    } catch (error) {
      this.logger.error('Error approving distribution:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to approve distribution: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
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

  /**
   * Get daily transaction analytics for an event
   */
  async getDailyAnalytics(eventId: string, dto: DailyAnalyticsDto) {
    try {
      const event = await this.findOne(eventId);

      // Set default date range if not provided (last 30 days)
      const endDate = dto.endDate
        ? new Date(dto.endDate)
        : new Date();
      const startDate = dto.startDate
        ? new Date(dto.startDate)
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch all transactions for this event in date range
      const transactions = await this.ticketTransactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.eventId = :eventId', { eventId: event.eventId })
        .andWhere('transaction.createdAt >= :startDate', { startDate })
        .andWhere('transaction.createdAt <= :endDate', { endDate })
        .orderBy('transaction.createdAt', 'ASC')
        .getMany();

      // Group transactions by date
      const dailyData = new Map<
        string,
        {
          date: string;
          purchaseCount: number;
          resellCount: number;
          purchaseRevenue: number;
          resellRevenue: number;
          totalRevenue: number;
          totalTransactions: number;
        }
      >();

      transactions.forEach((tx) => {
        const dateKey = tx.createdAt.toISOString().split('T')[0];

        if (!dailyData.has(dateKey)) {
          dailyData.set(dateKey, {
            date: dateKey,
            purchaseCount: 0,
            resellCount: 0,
            purchaseRevenue: 0,
            resellRevenue: 0,
            totalRevenue: 0,
            totalTransactions: 0,
          });
        }

        const dayData = dailyData.get(dateKey)!;
        const price = parseFloat(tx.price.toString());

        if (tx.transactionType === 'purchase') {
          dayData.purchaseCount++;
          dayData.purchaseRevenue += price;
        } else if (tx.transactionType === 'resell') {
          dayData.resellCount++;
          dayData.resellRevenue += price;
        }

        dayData.totalRevenue += price;
        dayData.totalTransactions++;
      });

      // Convert map to sorted array
      const dailyStats = Array.from(dailyData.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      // Calculate summary statistics
      const summary = {
        totalPurchases: dailyStats.reduce(
          (sum, day) => sum + day.purchaseCount,
          0,
        ),
        totalResells: dailyStats.reduce((sum, day) => sum + day.resellCount, 0),
        totalRevenue: dailyStats.reduce((sum, day) => sum + day.totalRevenue, 0),
        primaryRevenue: dailyStats.reduce(
          (sum, day) => sum + day.purchaseRevenue,
          0,
        ),
        secondaryRevenue: dailyStats.reduce(
          (sum, day) => sum + day.resellRevenue,
          0,
        ),
        averageDailyRevenue:
          dailyStats.length > 0
            ? dailyStats.reduce((sum, day) => sum + day.totalRevenue, 0) /
              dailyStats.length
            : 0,
        peakDay: dailyStats.reduce(
          (max, day) =>
            day.totalRevenue > (max?.totalRevenue || 0) ? day : max,
          dailyStats[0],
        ),
      };

      return {
        success: true,
        eventId: event.eventId,
        eventName: event.name,
        dateRange: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
        summary,
        dailyStats,
      };
    } catch (error) {
      this.logger.error('Error fetching daily analytics:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch daily analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get revenue breakdown for an event
   */
  async getRevenueBreakdown(eventId: string, userId: string) {
    try {
      const event = await this.findOne(eventId);

      // Verify ownership
      if (event.partnerId !== userId) {
        throw new BadRequestException(
          'You do not have permission to view revenue details for this event',
        );
      }

      // Get all transactions
      const transactions = await this.ticketTransactionRepository.find({
        where: { eventId: event.eventId },
        order: { createdAt: 'ASC' },
      });

      const primarySales = transactions.filter(
        (tx) => tx.transactionType === 'purchase',
      );
      const resales = transactions.filter(
        (tx) => tx.transactionType === 'resell',
      );

      // PRIMARY SALES = Volume only, NOT revenue/profit
      const primarySalesVolume = primarySales.reduce(
        (sum, tx) => sum + parseFloat(tx.price.toString()),
        0,
      );
      const primarySalesCount = primarySales.length;

      // RESALE = Transaction volume (for breakdown)
      const resaleVolume = resales.reduce(
        (sum, tx) => sum + parseFloat(tx.price.toString()),
        0,
      );

      // PROFIT from resales (calculated from previousPrice if available)
      const resaleProfit = resales.reduce((sum, tx) => {
        if (tx.profitAmount) {
          return sum + parseFloat(tx.profitAmount.toString());
        }
        // Fallback: calculate from previousPrice if available
        if (tx.previousPrice) {
          const profit =
            parseFloat(tx.price.toString()) -
            parseFloat(tx.previousPrice.toString());
          return sum + Math.max(0, profit);
        }
        return sum;
      }, 0);

      // Calculate royalties (for estimation only)
      const royaltyPercentage = event.totalRoyaltyPercentage || 0;

      // ✅ SOURCE OF TRUTH: Get escrow balance (actual distributable revenue)
      let actualDistributableRevenue = 0;
      let escrowBalance = 0;
      let royaltiesDistributed = 0;

      if (event.blockchainEnabled && event.eventPda) {
        try {
          const eventPda = new PublicKey(event.eventPda);
          escrowBalance = await this.solanaTicketService.getEscrowBalance(
            eventPda,
          );
          actualDistributableRevenue = escrowBalance;

          // Check blockchain events for distributed royalties
          const distributionEvents =
            event.blockchainEvents?.filter(
              (e) => e.eventType === 'royalty_distributed',
            ) || [];

          royaltiesDistributed = distributionEvents.reduce((sum, evt) => {
            return sum + (evt.eventData?.totalAmount || 0);
          }, 0);
        } catch (error) {
          this.logger.warn(`Failed to fetch blockchain royalty data: ${error}`);
        }
      }

      // Calculate partner shares from escrow balance
      // Partners split 100% of distributable revenue based on their relative percentages
      const totalPartnerPercentage = royaltyPercentage; // Sum of all partner percentages
      const partnerShares = (event.royaltyDistribution || []).map((partner) => ({
        partyName: partner.partyName,
        walletAddress: partner.walletAddress,
        percentage: partner.percentage,
        // Each partner gets their proportion of the total distributable revenue
        estimatedShare: totalPartnerPercentage > 0 
          ? (actualDistributableRevenue * partner.percentage) / totalPartnerPercentage
          : 0,
      }));

      // Platform gets nothing from distributable revenue (partners split 100%)
      const platformPercentage = 0;
      const platformShare = 0;

      // Price statistics
      const allPrices = transactions.map((tx) => parseFloat(tx.price.toString()));
      const avgPrice =
        allPrices.length > 0
          ? allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length
          : 0;
      const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
      const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;

      return {
        success: true,
        eventId: event.eventId,
        eventName: event.name,
        revenue: {
          // SOURCE OF TRUTH: Distributable revenue from blockchain escrow
          totalDistributableRevenue: actualDistributableRevenue,
          escrowBalance: actualDistributableRevenue,

          // Breakdown from DB (for analytics only, not actual revenue)
          primarySalesVolume: primarySalesVolume,
          primarySalesCount: primarySalesCount,
          resaleVolume: resaleVolume,
          resaleProfit: resaleProfit,

          // Legacy fields (deprecated but kept for backwards compatibility)
          totalRevenue: actualDistributableRevenue,
          primaryRevenue: 0, // Primary sales are not revenue
          secondaryRevenue: actualDistributableRevenue,
          primaryPercentage: 0,
          secondaryPercentage: 100,
        },
        transactions: {
          totalTransactions: transactions.length,
          primarySales: primarySales.length,
          resales: resales.length,
        },
        partnerShares: partnerShares,
        platformShare: platformShare,
        royalties: {
          royaltyPercentage,
          escrowBalance: actualDistributableRevenue,
          royaltiesCollected: escrowBalance,
          royaltiesDistributed: royaltiesDistributed,
          pendingRoyalties: escrowBalance,
          pendingDistribution: actualDistributableRevenue - royaltiesDistributed,
        },
        priceStatistics: {
          averagePrice: avgPrice,
          minimumPrice: minPrice,
          maximumPrice: maxPrice,
          originalTicketPrice: event.ticketPrice,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching revenue breakdown:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch revenue breakdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get ticket distribution analytics
   */
  async getTicketDistribution(eventId: string) {
    try {
      const event = await this.findOne(eventId);

      // Get all tickets from database
      const tickets = await this.ticketRepository.find({
        where: { eventId: event.eventId },
      });

      // Group by status
      const byStatus = {
        active: tickets.filter((t) => t.status === 'active').length,
        used: tickets.filter((t) => t.status === 'used').length,
        cancelled: tickets.filter((t) => t.status === 'cancelled').length,
      };

      // Group by resell count
      const byResellCount = {
        neverResold: tickets.filter((t) => t.resellCount === 0).length,
        resoldOnce: tickets.filter((t) => t.resellCount === 1).length,
        resoldTwice: tickets.filter((t) => t.resellCount === 2).length,
        resoldThreePlus: tickets.filter((t) => t.resellCount >= 3).length,
      };

      // Price distribution
      const prices = tickets.map((t) => parseFloat(t.currentPrice.toString()));
      const avgPrice =
        prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0;
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      // Find most/least valuable tickets
      const sortedByPrice = [...tickets].sort(
        (a, b) =>
          parseFloat(b.currentPrice.toString()) -
          parseFloat(a.currentPrice.toString()),
      );
      const mostValuable = sortedByPrice.slice(0, 5).map((t) => ({
        ticketId: t.ticketId,
        currentPrice: parseFloat(t.currentPrice.toString()),
        resellCount: t.resellCount,
      }));
      const leastValuable = sortedByPrice
        .slice(-5)
        .reverse()
        .map((t) => ({
          ticketId: t.ticketId,
          currentPrice: parseFloat(t.currentPrice.toString()),
          resellCount: t.resellCount,
        }));

      // Calculate price appreciation
      const priceChanges = tickets.map((t) => {
        const current = parseFloat(t.currentPrice.toString());
        const original = parseFloat(t.originalPrice.toString());
        return {
          ticketId: t.ticketId,
          appreciation: ((current - original) / original) * 100,
        };
      });
      const avgAppreciation =
        priceChanges.length > 0
          ? priceChanges.reduce((sum, pc) => sum + pc.appreciation, 0) /
            priceChanges.length
          : 0;

      return {
        success: true,
        eventId: event.eventId,
        eventName: event.name,
        summary: {
          totalTickets: event.totalTickets || 0,
          ticketsSold: tickets.length,
          ticketsRemaining: (event.totalTickets || 0) - tickets.length,
          soldPercentage:
            (event.totalTickets || 0) > 0
              ? (tickets.length / (event.totalTickets || 1)) * 100
              : 0,
        },
        byStatus,
        byResellCount,
        priceDistribution: {
          averagePrice: avgPrice,
          minimumPrice: minPrice,
          maximumPrice: maxPrice,
          originalPrice: event.ticketPrice ? parseFloat(event.ticketPrice.toString()) : 0,
          averageAppreciation: avgAppreciation,
        },
        topTickets: {
          mostValuable,
          leastValuable,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching ticket distribution:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch ticket distribution: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all transactions for an event
   */
  async getEventTransactions(eventId: string) {
    try {
      const event = await this.findOne(eventId);

      // Get all transactions ordered by date using QueryBuilder for more flexibility
      const queryBuilder = this.ticketTransactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.eventId = :businessId', {
          businessId: event.eventId,
        })
        .orWhere('transaction.eventId = :uuid', { uuid: event.id })
        .orWhere(
          "transaction.metadata::jsonb @> :metadataFilter",
          { metadataFilter: JSON.stringify({ eventId: event.eventId }) }
        )
        .orderBy('transaction.createdAt', 'DESC');

      const transactions = await queryBuilder.getMany();

      this.logger.log(
        `Found ${transactions.length} transactions for event ${event.eventId} (UUID: ${event.id})`,
      );

      return {
        success: true,
        eventId: event.eventId,
        eventName: event.name,
        totalTransactions: transactions.length,
        transactions: transactions.map((tx) => ({
          id: tx.id,
          ticketId: tx.ticketId,
          fromOwner: tx.fromOwner,
          toOwner: tx.toOwner,
          price: parseFloat(tx.price.toString()),
          transactionType: tx.transactionType,
          blockchainTxHash: tx.blockchainTxHash,
          status: tx.blockchainTxStatus,
          createdAt: tx.createdAt,
          metadata: tx.metadata,
        })),
      };
    } catch (error) {
      this.logger.error('Error fetching event transactions:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch transactions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
