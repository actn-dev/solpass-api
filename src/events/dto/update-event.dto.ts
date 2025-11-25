import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';
import { IsArray, IsOptional, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTO for updating only partner wallet addresses
export class UpdatePartnerWalletDto {
  @ApiProperty({
    example: 'Artist',
    description: 'Party name (must match existing partner)',
  })
  @IsString()
  partyName: string;

  @ApiProperty({
    example: 'So1ana...wallet',
    description: 'Solana wallet address to set for this partner',
  })
  @IsString()
  walletAddress: string;
}

// Cannot update eventId, totalTickets, ticketPrice after creation
// royaltyDistribution can be updated to add/change wallet addresses only
export class UpdateEventDto extends PartialType(
  OmitType(CreateEventDto, [
    'eventId',
    'totalTickets',
    'ticketPrice',
    'royaltyDistribution',
  ] as const),
) {
  @ApiPropertyOptional({
    description:
      'Update partner wallet addresses only. Pass array of {partyName, walletAddress}. Cannot change percentages or add/remove partners after blockchain initialization.',
    type: [UpdatePartnerWalletDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePartnerWalletDto)
  royaltyDistribution?: UpdatePartnerWalletDto[];
}
