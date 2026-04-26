import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/customer/notifications/unread-count - Get unread notification count
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Get notifications for this user (ALL + SPECIFIC where user is recipient)
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

    // 2. Get deleted notification IDs
    const deletedStatuses = await prisma.notificationStatus.findMany({
      where: {
        userId: payload.sub,
        isDeleted: true,
      },
      select: { notificationId: true },
    });
    const deletedIds = new Set(deletedStatuses.map((s) => s.notificationId));

    // Filter out deleted
    allNotifications = allNotifications.filter((n) => !deletedIds.has(n.id));

    // 3. Get read notification IDs
    const readStatuses = await prisma.notificationStatus.findMany({
      where: {
        userId: payload.sub,
        isRead: true,
      },
      select: { notificationId: true },
    });
    const readIds = new Set(readStatuses.map((s) => s.notificationId));

    // Count unread
    const count = allNotifications.filter((n) => !readIds.has(n.id)).length;

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unread count' },
      { status: 500 }
    );
  }
}
