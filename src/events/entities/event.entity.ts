import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export interface RoyaltyPartner {
  partyName: string;
  percentage: number;
  walletAddress?: string;
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  eventId: string; // Business logic ID

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  venue: string;

  @Column({ type: 'timestamp' })
  eventDate: Date;

  @Column({ type: 'int' })
  totalTickets: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  ticketPrice: number;

  // Blockchain-related fields
  @Column({ default: false })
  blockchainEnabled: boolean;

  @Column({ nullable: true })
  eventPda: string; // Program Derived Address

  @Column({ nullable: true })
  escrowPda: string;

  @Column({ nullable: true })
  blockchainInitTxHash: string;

  @Column({ type: 'timestamp', nullable: true })
  blockchainInitializedAt: Date;

  @Column({ nullable: true })
  eventPublicKey: string; // Generated keypair public key

  @Column({ nullable: true, select: false }) // Never select by default for security
  eventSecretKey: string; // Should be encrypted in production

  // Royalty information
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  totalRoyaltyPercentage: number;

  @Column({ type: 'jsonb', nullable: true })
  royaltyDistribution: RoyaltyPartner[];

  // Blockchain event history (audit trail)
  @Column({ type: 'jsonb', nullable: true })
  blockchainEvents: Array<{
    eventType: string; // 'event_init', 'event_init_failed', 'royalty_distributed', etc.
    txHash?: string;
    walletAddress?: string;
    eventData?: Record<string, any>;
    timestamp: number;
  }>;

  // Relations
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'partnerId' })
  partner: User;

  @Column()
  partnerId: string;

  // Timestamps
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date; // Soft delete support
}
