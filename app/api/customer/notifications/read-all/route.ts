import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/customer/notifications/read-all - Mark all notifications as read
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Get all notifications for this user
    const [globalNotifications, specificNotifications] = await Promise.all([
      prisma.notification.findMany({
        where: { targetType: 'ALL' },
      }),
      prisma.notification.findMany({
        where: {
          targetType: 'SPECIFIC',
          recipients: {
            some: { userId: payload.sub },
          },
        },
      }),
    ]);

    let allNotifications = [...globalNotifications, ...specificNotifications];
    
    // Remove duplicates
    const seen = new Set();
    allNotifications = allNotifications.filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });

    // 2. Get already read notification IDs
    const readStatuses = await prisma.notificationStatus.findMany({
      where: {
        userId: payload.sub,
        isRead: true,
      },
      select: { notificationId: true },
    });
    const readIds = new Set(readStatuses.map((s) => s.notificationId));

    // 3. Filter only unread notifications
    const unreadNotifications = allNotifications.filter((n) => !readIds.has(n.id));

    // 4. Create notificationStatus for each unread notification
    let markedCount = 0;
    for (const notification of unreadNotifications) {
      await prisma.notificationStatus.upsert({
        where: {
          userId_notificationId: {
            userId: payload.sub,
            notificationId: notification.id,
          },
        },
        update: {
          isRead: true,
          readAt: new Date(),
        },
        create: {
          userId: payload.sub,
          notificationId: notification.id,
          isRead: true,
          readAt: new Date(),
        },
      });
      markedCount++;
    }

    return NextResponse.json({
      success: true,
      markedAsRead: markedCount,
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}
