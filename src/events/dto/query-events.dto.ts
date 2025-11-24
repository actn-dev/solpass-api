import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryEventsDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Filter by partner ID' })
  @IsOptional()
  @IsString()
  partnerId?: string;

  @ApiPropertyOptional({ description: 'Filter by blockchain enabled status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  blockchainEnabled?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter only upcoming events',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  upcoming?: boolean;

  @ApiPropertyOptional({
    example: 'Rock',
    description: 'Search in name and description',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
