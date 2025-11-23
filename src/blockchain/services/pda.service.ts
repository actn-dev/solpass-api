import { Injectable } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

@Injectable()
export class PdaService {
  /**
   * Derive event PDA
   * From your deriveEventPDA function
   */
  deriveEventPDA(
    programId: PublicKey,
    authority: PublicKey,
    eventId: string,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('EVENT_STATE'), authority.toBuffer(), Buffer.from(eventId)],
      programId,
    );
  }

  /**
   * Derive ticket PDA
   */
  deriveTicketPDA(
    programId: PublicKey,
    eventPDA: PublicKey,
    ticketId: string,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('TICKET_STATE'), eventPDA.toBuffer(), Buffer.from(ticketId)],
      programId,
    );
  }

  /**
   * Derive royalty escrow PDA
   */
  deriveRoyaltyEscrowPDA(
    programId: PublicKey,
    eventPDA: PublicKey,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('ROYALTY_ESCROW'), eventPDA.toBuffer()],
      programId,
    );
  }
}
