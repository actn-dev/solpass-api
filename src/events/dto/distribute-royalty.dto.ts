import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for distribute royalty endpoint
 * Partners are automatically extracted from event.royaltyDistribution in the database
 * No input parameters required
 */
export class DistributeRoyaltyDto {
  // Empty DTO - all data is extracted from the event in the database
  // This ensures type safety while accepting an empty request body
}
