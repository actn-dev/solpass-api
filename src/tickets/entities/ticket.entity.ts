import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Event } from '../../events/entities/event.entity';

export enum TicketStatus {
  ACTIVE = 'active',
  USED = 'used',
  CANCELLED = 'cancelled',
}

@Entity('tickets')
@Index(['ticketId', 'eventId'], { unique: true })
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  ticketId: string; // Business logic ID (e.g., 'ticket-001')

  @Column()
  eventId: string; // Business logic event ID (e.g., 'concert-001')

  @ManyToOne(() => Event, { eager: false })
  @JoinColumn({ name: 'eventId', referencedColumnName: 'eventId' })
  event: Event;

  @Column()
  currentOwner: string; // Current owner ID or wallet address

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  currentPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  originalPrice: number;

  @Column({ type: 'int', default: 0 })
  resellCount: number;

  @Column({ nullable: true })
  ticketPda: string; // Blockchain PDA address

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.ACTIVE,
  })
  status: TicketStatus;

  @Column({ type: 'timestamp', nullable: true })
  purchaseDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
