import {
  IsString,
  Length,
  Matches,
  IsNumber,
  IsDateString,
  IsOptional,
  Min,
} from 'class-validator';
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
    description: 'Event name (max 10 chars)',
  })
  @IsString()
  @Length(1, 10)
  name: string;

  @ApiPropertyOptional({
    example: 'Amazing rock concert',
    description: 'Event description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '23,2,10',
    description: 'Comma-separated royalty percentages for parties',
  })
  @IsString()
  @Matches(/^\d+(,\d+)*$/, {
    message: 'Royalty must be comma-separated numbers (e.g., "23,2,10")',
  })
  royalty: string;

  @ApiPropertyOptional({
    example: 'Madison Square Garden',
    description: 'Event venue',
  })
  @IsString()
  @IsOptional()
  venue?: string;

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
    description: 'Ticket price in USD (whole number)',
  })
  @IsNumber()
  @Min(1)
  ticketPrice: number;

  @ApiProperty({
    example: '7xKzU8fPPwV3wkF9YqGVXJb4qQZ3GqYvJ9Z3sV7wV7wV',
    description: 'Authority wallet public key (base58)',
  })
  @IsString()
  authority: string;
}
