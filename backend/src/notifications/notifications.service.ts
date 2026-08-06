import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  payload: Prisma.JsonValue | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, limit = 50): Promise<NotificationItem[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 100)),
    });

    return notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
      payload: notification.payload ?? null,
    }));
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    return {
      id: updated.id,
      isRead: updated.isRead,
      readAt: updated.readAt?.toISOString() ?? null,
    };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { success: true };
  }
}