import { IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty({
    example: 'ticket-001',
    description: 'Unique ticket identifier',
  })
  @IsString()
  ticketId: string;

  @ApiProperty({
    example: '7xKzU8fPPwV3wkF9YqGVXJb4qQZ3GqYvJ9Z3sV7wV7wV',
    description: 'Buyer wallet public key (base58)',
  })
  @IsString()
  buyerWallet: string;

  @ApiProperty({
    example: '8yKzU8fPPwV3wkF9YqGVXJb4qQZ3GqYvJ9Z3sV7wV7wX',
    description: 'Seller wallet public key (base58)',
  })
  @IsString()
  sellerWallet: string;

  @ApiProperty({ example: 120, description: 'New resale price in USD' })
  @IsNumber()
  @Min(1)
  newPrice: number;

  @ApiProperty({
    example: 100,
    description: 'Original ticket purchase price in USD',
  })
  @IsNumber()
  @Min(1)
  originalPrice: number;

  @ApiProperty({
    example: 'buyer-123',
    description: 'Buyer ID for ticket ownership',
  })
  @IsString()
  buyerId: string;

  @ApiProperty({
    example: 'seller-456',
    description: 'Seller ID for ticket ownership',
  })
  @IsString()
  sellerId: string;
}
