import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  Connection,
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);

  constructor(
    @Inject('SOLANA_CONNECTION') private readonly connection: Connection,
    @Inject('SERVER_WALLET') private readonly serverWallet: Keypair,
  ) {}

  getConnection(): Connection {
    return this.connection;
  }

  getServerWalletAddress(): string {
    return this.serverWallet.publicKey.toBase58();
  }

  /**
   * Send transaction with retry logic
   */
  async sendAndConfirmWithRetry(
    transaction: Transaction,
    signers: Keypair[],
    maxRetries = 3,
  ): Promise<string> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(
          `Sending transaction (attempt ${attempt}/${maxRetries})`,
        );

        const signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          signers,
          { commitment: 'confirmed' },
        );

        this.logger.log(`Transaction confirmed: ${signature}`);
        return signature;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Transaction attempt ${attempt} failed: ${lastError.message}`,
        );

        if (attempt < maxRetries) {
          await this.sleep(1000 * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(
      `Transaction failed after ${maxRetries} attempts: ${lastError.message}`,
    );
  }
  /**
   * Get transaction status
   */
  async getTransactionStatus(
    signature: string,
  ): Promise<'confirmed' | 'finalized' | 'failed'> {
    try {
      const status = await this.connection.getSignatureStatus(signature);

      if (status.value === null) {
        return 'failed';
      }

      if (status.value.confirmationStatus === 'finalized') {
        return 'finalized';
      }

      if (status.value.confirmationStatus === 'confirmed') {
        return 'confirmed';
      }

      return 'failed';
    } catch (error) {
      this.logger.error(`Error checking transaction status: ${error.message}`);
      return 'failed';
    }
  }
  /**
   * Wait for transaction confirmation with timeout
   */
  async waitForConfirmation(
    signature: string,
    timeoutMs = 30000,
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getTransactionStatus(signature);

      if (status === 'confirmed' || status === 'finalized') {
        return true;
      }

      if (status === 'failed') {
        return false;
      }

      await this.sleep(1000); // Poll every second
    }

    this.logger.warn(`Transaction confirmation timeout: ${signature}`);
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
