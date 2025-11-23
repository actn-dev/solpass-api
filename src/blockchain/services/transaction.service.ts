import { Injectable, Logger } from '@nestjs/common';
import { Transaction, TransactionInstruction } from '@solana/web3.js';
import { SolanaService } from './solana.service';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(private readonly solanaService: SolanaService) {}

  /**
   * Build transaction with recent blockhash
   */
  async buildTransaction(
    instructions: TransactionInstruction[],
  ): Promise<Transaction> {
    const transaction = new Transaction();

    // Add instructions
    instructions.forEach((ix) => transaction.add(ix));

    // Get recent blockhash
    const { blockhash } = await this.solanaService
      .getConnection()
      .getLatestBlockhash();

    transaction.recentBlockhash = blockhash;

    return transaction;
  }

  /**
   * Estimate transaction fee
   */
  async estimateFee(transaction: Transaction): Promise<number> {
    try {
      const fee = await transaction.getEstimatedFee(
        this.solanaService.getConnection(),
      );
      return fee || 5000; // Default fallback
    } catch (error) {
      this.logger.warn(`Fee estimation failed: ${error.message}`);
      return 5000; // Default 5000 lamports
    }
  }
}
