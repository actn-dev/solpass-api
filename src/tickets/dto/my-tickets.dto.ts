import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MyTicketsDto {
  @ApiProperty({
    example: 'wallet123...',
    description: 'Wallet address or user ID to query tickets for',
  })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;
}
