import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { DistributeRoyaltyDto } from './dto/distribute-royalty.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventOwnerGuard } from './guards/event-owner.guard';

@ApiTags('Events')
@Controller('api/v1/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new event (database only, blockchain init separate)',
  })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createEvent(@Body() dto: CreateEventDto, @Request() req) {
    console.log(req.user);
    return this.eventsService.createEvent(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all events with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Events list retrieved' })
  async findAll(@Query() query: QueryEventsDto) {
    return this.eventsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event details by ID' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({ status: 200, description: 'Event details retrieved' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Post(':id/initialize-blockchain')
  @UseGuards(JwtAuthGuard, EventOwnerGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize event on blockchain' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({
    status: 200,
    description: 'Blockchain initialized successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request or already initialized',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not event owner' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async initializeBlockchain(@Param('id') id: string, @Request() req) {
    return this.eventsService.initializeBlockchain(id, req.user.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, EventOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update event details' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not event owner' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @Request() req,
  ) {
    return this.eventsService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, EventOwnerGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete event (soft delete)' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({ status: 200, description: 'Event deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot delete blockchain-enabled events',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not event owner' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async remove(@Param('id') id: string, @Request() req) {
    return this.eventsService.remove(id, req.user.userId);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard, EventOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get event statistics' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({ status: 200, description: 'Event stats retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not event owner' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getStats(@Param('id') id: string, @Request() req) {
    return this.eventsService.getStats(id, req.user.userId);
  }

  @Post(':id/distribute')
  @UseGuards(JwtAuthGuard, EventOwnerGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Distribute royalties to party wallets' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({
    status: 200,
    description: 'Royalties distributed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request or already distributed',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not event owner' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async distributeRoyalty(
    @Param('id') id: string,
    @Body() dto: DistributeRoyaltyDto,
    @Request() req,
  ) {
    return this.eventsService.distributeRoyalty(id, dto, req.user.userId);
  }

  @Get(':id/escrow')
  @UseGuards(JwtAuthGuard, EventOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get escrow balance for an event' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({ status: 200, description: 'Escrow balance retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not event owner' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEscrowBalance(@Param('id') id: string, @Request() req) {
    return this.eventsService.getEscrowBalance(id, req.user.userId);
  }
}
