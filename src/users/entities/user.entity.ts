import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ unique: true })
  walletAddress: string;

  @Column({ nullable: true, unique: true })
  apiKey: string;

  @Column({ default: 'partner' })
  role: string; // 'partner', 'admin', 'user'

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations will be added when we create Event entity
  // @OneToMany(() => Event, event => event.user)
  // events: Event[];
}
