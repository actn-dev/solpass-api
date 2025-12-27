import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum TransactionType {
  PURCHASE = 'purchase',
  RESELL = 'resell',
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Entity('ticket_transactions')
@Index(['ticketId'])
@Index(['eventId'])
@Index(['toOwner'])
export class TicketTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ticketId: string; // For easy querying without joins

  @Column()
  eventId: string; // For filtering by event

  @Column({ type: 'varchar', nullable: true })
  fromOwner?: string; // null for initial purchase

  @Column({ type: 'varchar' })
  toOwner: string; // New owner after transaction

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  previousPrice?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  profitAmount: number;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  transactionType: TransactionType;

  @Column({ nullable: true })
  blockchainTxHash: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.CONFIRMED,
  })
  blockchainTxStatus: TransactionStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    eventId?: string;
    buyerWallet?: string;
    sellerWallet?: string;
    ticketPda?: string;
  };

  @CreateDateColumn()
  createdAt: Date;
}
