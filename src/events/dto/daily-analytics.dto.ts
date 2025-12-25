import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DailyAnalyticsDto {
  @ApiPropertyOptional({
    example: '2024-01-01',
    description: 'Start date for analytics (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2024-12-31',
    description: 'End date for analytics (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
