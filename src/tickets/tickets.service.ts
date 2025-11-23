import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicKey } from '@solana/web3.js';
import { SolanaConfig } from '../config/configuration';
import { PdaService } from '../blockchain/services/pda.service';
import { SolanaService } from '../blockchain/services/solana.service';
import { SolanaTicketService } from '../blockchain/solana-ticket/solana-ticket.service';
import { EventsService } from '../events/events.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly programId: PublicKey;

  constructor(
    private readonly solanaTicketService: SolanaTicketService,
    private readonly solanaService: SolanaService,
    private readonly pdaService: PdaService,
    private readonly configService: ConfigService,
    private readonly eventsService: EventsService,
  ) {
    this.programId = new PublicKey(
      this.configService.getOrThrow<SolanaConfig>('solana').programId,
    );
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
}
