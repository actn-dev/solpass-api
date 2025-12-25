import {
  Controller,
  Get,
  Query,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';

@ApiTags('Tickets')
@Controller('api/v1/tickets')
export class TicketsGlobalController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('my-tickets')
  @ApiOperation({
    summary: 'Get all tickets owned by a wallet address',
    description:
      'Returns all tickets owned by the specified wallet address across all events, grouped by event with portfolio statistics.',
  })
  @ApiQuery({
    name: 'walletAddress',
    example: 'wallet123...',
    description: 'Wallet address or user ID to query tickets for',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'User tickets retrieved successfully with portfolio stats',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid wallet address',
  })
  async getMyTickets(@Query('walletAddress') walletAddress: string) {
    return this.ticketsService.getTicketsByWallet(walletAddress);
  }
}
