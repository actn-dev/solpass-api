import {
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus } from '../entities/ticket.entity';

export class QueryTicketsDto {
  @ApiPropertyOptional({
    enum: TicketStatus,
    description: 'Filter by ticket status',
  })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({
    example: 50,
    description: 'Minimum ticket price',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    example: 200,
    description: 'Maximum ticket price',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Maximum resell count',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxResellCount?: number;

  @ApiPropertyOptional({
    example: '0x123...',
    description: 'Filter by current owner wallet address',
  })
  @IsOptional()
  @IsString()
  owner?: string;
}
