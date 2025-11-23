import { Injectable, Inject, Logger } from '@nestjs/common';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  getAccount,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { USDC_MINT_PUBKEY } from '../constants/solana.constants';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    @Inject('SOLANA_CONNECTION') private readonly connection: Connection,
    @Inject('SERVER_WALLET') private readonly serverWallet: Keypair,
  ) {}

  /**
   * Get or create associated token account
   * Adapted from your getOrCreateAssociatedTokenAccount calls
   */
  async getOrCreateTokenAccount(
    mint: PublicKey,
    owner: PublicKey,
  ): Promise<PublicKey> {
    const account = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.serverWallet, // Server pays for account creation
      mint,
      owner,
    );

    return account.address;
  }

  /**
   * Get token balance
   * From your getSolpassBalance function
   */
  async getTokenBalance(mint: PublicKey, owner: PublicKey): Promise<number> {
    try {
      const tokenAccountAddress = await getAssociatedTokenAddress(mint, owner);
      const accountInfo = await getAccount(
        this.connection,
        tokenAccountAddress,
      );

      // Convert from base units (6 decimals for USDC)
      return Number(accountInfo.amount) / Math.pow(10, 6);
    } catch (error) {
      this.logger.warn(`Token account not found for ${owner.toBase58()}`);
      return 0;
    }
  }

  /**
   * Get USDC balance for a wallet
   */
  async getUsdcBalance(owner: PublicKey): Promise<number> {
    const USDC_MINT = new PublicKey(USDC_MINT_PUBKEY);
    return this.getTokenBalance(USDC_MINT, owner);
  }

  /**
   * Check if token account exists
   */
  async tokenAccountExists(
    mint: PublicKey,
    owner: PublicKey,
  ): Promise<boolean> {
    try {
      const tokenAccountAddress = await getAssociatedTokenAddress(mint, owner);
      await getAccount(this.connection, tokenAccountAddress);
      return true;
    } catch {
      return false;
    }
  }
}
