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
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { DistributeRoyaltyDto } from './dto/distribute-royalty.dto';

@ApiTags('Events')
@Controller('api/v1/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new event on the blockchain' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createEvent(@Body() dto: CreateEventDto) {
    return this.eventsService.createEvent(dto);
  }

  @Get(':eventId')
  @ApiOperation({ summary: 'Get event details' })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  @ApiResponse({ status: 200, description: 'Event details retrieved' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEvent(@Param('eventId') eventId: string) {
    return this.eventsService.getEvent(eventId);
  }

  @Post(':eventId/distribute')
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
    return this.eventsService.distributeRoyalty(eventId, dto);
  }

  @Get(':eventId/escrow')
  @ApiOperation({ summary: 'Get escrow balance for an event' })
  @ApiParam({ name: 'eventId', example: 'concert-001' })
  @ApiResponse({ status: 200, description: 'Escrow balance retrieved' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEscrowBalance(@Param('eventId') eventId: string) {
    return this.eventsService.getEscrowBalance(eventId);
  }
}
