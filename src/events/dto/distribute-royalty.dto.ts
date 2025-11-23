import { IsString, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DistributeRoyaltyDto {
  @ApiProperty({
    example: '7xKzU8fPPwV3wkF9YqGVXJb4qQZ3GqYvJ9Z3sV7wV7wV',
    description: 'Authority wallet public key (must match event creator)',
  })
  @IsString()
  authority: string;

  @ApiProperty({
    example: [
      '7xKzU8fPPwV3wkF9YqGVXJb4qQZ3GqYvJ9Z3sV7wV7wV',
      '8yKzU8fPPwV3wkF9YqGVXJb4qQZ3GqYvJ9Z3sV7wV7wX',
      '9zKzU8fPPwV3wkF9YqGVXJb4qQZ3GqYvJ9Z3sV7wV7wY',
    ],
    description:
      'Array of wallet addresses for royalty distribution (order matches royalty percentages)',
  })
  @IsArray()
  @IsString({ each: true })
  partyAddresses: string[];
}
