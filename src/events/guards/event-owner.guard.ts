import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../entities/event.entity';

@Injectable()
export class EventOwnerGuard implements CanActivate {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Set by JwtAuthGuard
    const eventId = request.params.eventId || request.params.id;

    if (!eventId) {
      throw new ForbiddenException('Event ID not provided');
    }

    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: ['id', 'partnerId'],
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check if user owns this event
    if (event.partnerId !== user.userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this event',
      );
    }

    return true;
  }
}
