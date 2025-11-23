import { IsString, Length, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty({
    example: 'concert-001',
    description: 'Unique event identifier (max 16 chars)',
  })
  @IsString()
  @Length(1, 16)
  eventId: string;

  @ApiProperty({
    example: 'Rock Show',
    description: 'Event name (max 32 chars)',
  })
  @IsString()
  @Length(1, 32)
  name: string;

  @ApiProperty({
    example: '2,2,10',
    description:
      'Comma-separated royalty percentages for parties (e.g., "2,2,10" means 2% to party1, 2% to party2, 10% to party3)',
  })
  @IsString()
  @Matches(/^\d+(,\d+)*$/, {
    message: 'Royalty must be comma-separated numbers (e.g., "2,2,10")',
  })
  royalty: string;

  @ApiPropertyOptional({
    example: 'Amazing rock concert',
    description: 'Event description (optional, stored off-chain)',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'Madison Square Garden',
    description: 'Event venue (optional, stored off-chain)',
  })
  @IsString()
  @IsOptional()
  venue?: string;

  @ApiPropertyOptional({
    example: '2025-12-31T20:00:00Z',
    description: 'Event date (optional, stored off-chain)',
  })
  @IsString()
  @IsOptional()
  eventDate?: string;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Total tickets (optional, stored off-chain)',
  })
  @IsOptional()
  totalTickets?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Ticket price (optional, stored off-chain)',
  })
  @IsOptional()
  ticketPrice?: number;
}
