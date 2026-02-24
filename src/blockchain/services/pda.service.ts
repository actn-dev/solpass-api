import { Inject, Injectable } from '@nestjs/common';
import { Keypair, PublicKey } from '@solana/web3.js';
import { SERVER_WALLET } from '../constants/solana.constants';

@Injectable()
export class PdaService {
  constructor(@Inject(SERVER_WALLET) private readonly serverWallet: Keypair) {}
  /**
   * Derive event PDA
   * From your deriveEventPDA function
   */
  deriveEventPDA(programId: PublicKey, eventId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('EVENT_STATE'),
        this.serverWallet.publicKey.toBuffer(),
        Buffer.from(eventId),
      ],
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

  /**
   * Derive distribution approval PDA
   * Seeds: [APPROVAL_STATE, eventPDA]
   */
  deriveApprovalPDA(
    programId: PublicKey,
    eventPDA: PublicKey,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('APPROVAL_STATE'), eventPDA.toBuffer()],
      programId,
    );
  }
}
