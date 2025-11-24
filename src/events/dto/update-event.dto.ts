import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';

// Cannot update eventId, totalTickets, ticketPrice, royaltyDistribution after creation
export class UpdateEventDto extends PartialType(
  OmitType(CreateEventDto, [
    'eventId',
    'totalTickets',
    'ticketPrice',
    'royaltyDistribution',
  ] as const),
) {}
