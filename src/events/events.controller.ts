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
import { DailyAnalyticsDto } from './dto/daily-analytics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { EventOwnerGuard } from './guards/event-owner.guard';

@ApiTags('Events')
@Controller('api/v1/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new event (API Key auth - database only, blockchain init separate)',
  })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid API key' })
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
  @UseGuards(ApiKeyGuard, EventOwnerGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize event on blockchain (API Key auth)' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({
    status: 200,
    description: 'Blockchain initialized successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request or already initialized',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid API key' })
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
  @UseGuards(ApiKeyGuard, EventOwnerGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Distribute royalties to party wallets (API Key auth)',
    description:
      'No request body needed. Partners and their wallet addresses are automatically extracted from the event database. All partners must have USDC token accounts enabled first.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({
    status: 200,
    description: 'Royalties distributed successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - already distributed, no royalties, or partners missing USDC accounts',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid API key' })
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

  @Post(':id/enable-partner-usdc')
  @UseGuards(JwtOrApiKeyGuard, EventOwnerGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Enable USDC token accounts for all partners (JWT or API Key auth)',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({
    status: 200,
    description: 'USDC accounts enabled for partners',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - partners missing wallet addresses',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden - not event owner' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async enablePartnerUsdcAccounts(@Param('id') id: string, @Request() req) {
    return this.eventsService.enablePartnerUsdcAccounts(id, req.user.userId);
  }

  @Get(':id/analytics/daily')
  @ApiOperation({
    summary: 'Get daily transaction analytics for an event',
    description:
      'Returns daily purchase/resell counts and revenue. Defaults to last 30 days if no date range provided.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({
    status: 200,
    description: 'Daily analytics retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getDailyAnalytics(
    @Param('id') id: string,
    @Query() query: DailyAnalyticsDto,
  ) {
    return this.eventsService.getDailyAnalytics(id, query);
  }

  @Get(':id/analytics/revenue')
  @UseGuards(JwtAuthGuard, EventOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get revenue breakdown for an event',
    description:
      'Returns primary vs secondary revenue, royalties collected/distributed, and price statistics.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({
    status: 200,
    description: 'Revenue breakdown retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not event owner' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getRevenueBreakdown(@Param('id') id: string, @Request() req) {
    return this.eventsService.getRevenueBreakdown(id, req.user.userId);
  }

  @Get(':id/analytics/tickets')
  @ApiOperation({
    summary: 'Get ticket distribution analytics',
    description:
      'Returns tickets grouped by status, resell count, price distribution, and top tickets.',
  })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({
    status: 200,
    description: 'Ticket distribution analytics retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getTicketDistribution(@Param('id') id: string) {
    return this.eventsService.getTicketDistribution(id);
  }
}
