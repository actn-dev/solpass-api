import {
  IsString,
  Length,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  Max,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoyaltyPartner } from '../entities/event.entity';

export class RoyaltyPartnerDto implements RoyaltyPartner {
  @ApiProperty({ example: 'Artist', description: 'Party name' })
  @IsString()
  partyName: string;

  @ApiProperty({ example: 5, description: 'Percentage (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;

  @ApiPropertyOptional({
    example: 'So1ana...wallet',
    description: 'Solana wallet address',
  })
  @IsString()
  @IsOptional()
  walletAddress?: string;
}

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
    example: 'Amazing rock concert',
    description: 'Event description',
  })
  @IsString()
  description: string;

  @ApiProperty({
    example: 'Madison Square Garden',
    description: 'Event venue',
  })
  @IsString()
  venue: string;

  @ApiProperty({
    example: '2025-12-31T20:00:00Z',
    description: 'Event date in ISO format',
  })
  @IsDateString()
  eventDate: string;

  @ApiProperty({
    example: 1000,
    description: 'Total number of tickets available',
  })
  @IsNumber()
  @Min(1)
  totalTickets: number;

  @ApiProperty({
    example: 100,
    description: 'Ticket price in USD (e.g., 100.00)',
  })
  @IsNumber()
  @Min(0)
  ticketPrice: number;

  @ApiProperty({
    example: [
      { partyName: 'Artist', percentage: 5 },
      { partyName: 'Venue', percentage: 3 },
    ],
    description: 'Royalty distribution among parties',
    type: [RoyaltyPartnerDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoyaltyPartnerDto)
  @ArrayMinSize(1)
  royaltyDistribution: RoyaltyPartnerDto[];
}
