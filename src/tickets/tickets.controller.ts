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
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@ApiTags('Tickets')
@Controller('api/v1/events/:eventId/tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Purchase or resell a ticket' })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  @ApiResponse({ status: 201, description: 'Ticket purchased successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async purchaseTicket(
    @Param('eventId') eventId: string,
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketsService.purchaseTicket(eventId, dto);
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
}
