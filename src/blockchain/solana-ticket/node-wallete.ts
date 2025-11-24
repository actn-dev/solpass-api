import { Wallet } from '@coral-xyz/anchor';
import {
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';

import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

/**
 * Node only wallet.
 */
export class NodeWallet implements Wallet {
  constructor(readonly payer: Keypair) {}

  async signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T,
  ): Promise<T> {
    if (tx instanceof Transaction) {
      tx.partialSign(this.payer);
    } else if ('sign' in tx) {
      tx.sign([this.payer]);
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<T[]> {
    return Promise.all(txs.map((tx) => this.signTransaction(tx)));
  }

  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
}
