import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TicketService } from './ticket.service';
import { CreateEventDto } from './dto/create-event.dto';
import { PurchaseTicketDto } from './dto/purchase-ticket.dto';
import { DistributeRoyaltyDto } from './dto/distribute-royalty.dto';

@ApiTags('Ticket Operations')
@Controller('api/v1/ticket')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new event on the blockchain' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createEvent(@Body() dto: CreateEventDto) {
    return this.ticketService.createEvent(dto);
  }

  @Post('events/:eventId/tickets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Purchase or resell a ticket' })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  @ApiResponse({ status: 201, description: 'Ticket purchased successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async purchaseTicket(
    @Param('eventId') eventId: string,
    @Body() dto: PurchaseTicketDto,
  ) {
    return this.ticketService.purchaseTicket(eventId, dto);
  }

  @Post('events/:eventId/distribute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Distribute royalties to party wallets' })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  @ApiResponse({
    status: 200,
    description: 'Royalties distributed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request or already distributed',
  })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async distributeRoyalty(
    @Param('eventId') eventId: string,
    @Body() dto: DistributeRoyaltyDto,
  ) {
    return this.ticketService.distributeRoyalty(eventId, dto);
  }

  @Get('events/:eventId')
  @ApiOperation({ summary: 'Get event details' })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  @ApiResponse({ status: 200, description: 'Event details retrieved' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEvent(@Param('eventId') eventId: string) {
    return this.ticketService.getEvent(eventId);
  }

  @Get('events/:eventId/tickets/:ticketId')
  @ApiOperation({ summary: 'Get ticket details' })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  @ApiParam({ name: 'ticketId', example: 'ticket-001' })
  @ApiResponse({ status: 200, description: 'Ticket details retrieved' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getTicket(
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
  ) {
    return this.ticketService.getTicket(eventId, ticketId);
  }

  @Get('events/:eventId/escrow')
  @ApiOperation({ summary: 'Get escrow balance for an event' })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  @ApiResponse({ status: 200, description: 'Escrow balance retrieved' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEscrowBalance(@Param('eventId') eventId: string) {
    return this.ticketService.getEscrowBalance(eventId);
  }
}
