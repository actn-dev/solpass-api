import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@ApiTags('Tickets')
@Controller('api/v1/events/:eventId/tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Purchase or resell a ticket (API Key auth required)',
  })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  @ApiResponse({ status: 201, description: 'Ticket purchased successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid API key' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async purchaseTicket(
    @Param('eventId') eventId: string,
    @Body() dto: CreateTicketDto,
    @Request() req,
  ) {
    return this.ticketsService.purchaseTicket(eventId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tickets for an event' })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  @ApiResponse({
    status: 200,
    description: 'All tickets for event retrieved from blockchain',
  })
  async getEventTickets(@Param('eventId') eventId: string) {
    return this.ticketsService.getEventTickets(eventId);
  }

  @Get(':ticketId')
  @ApiOperation({ summary: 'Get ticket details' })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  @ApiParam({ name: 'ticketId', example: 'ticket-001' })
  @ApiResponse({ status: 200, description: 'Ticket details retrieved' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getTicket(
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
  ) {
    return this.ticketsService.getTicket(eventId, ticketId);
  }

  @Get(':ticketId/history')
  @ApiOperation({ summary: 'Get ticket transaction history' })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  @ApiParam({ name: 'ticketId', example: 'ticket-001' })
  @ApiResponse({
    status: 200,
    description: 'Ticket transaction history retrieved',
  })
  @ApiResponse({ status: 404, description: 'No history found' })
  async getTicketHistory(
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
  ) {
    return this.ticketsService.getTicketHistory(eventId, ticketId);
  }
}
