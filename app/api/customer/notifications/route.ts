import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/customer/notifications - Get notifications for current user
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const filter = searchParams.get('filter'); // 'all' | 'unread'

    const skip = (page - 1) * limit;

    // 1. Get notifications that are:
    //    - targetType = 'ALL' (global notifications)
    //    - OR targetType = 'SPECIFIC' AND user is in recipients
    const [globalNotifications, specificNotifications] = await Promise.all([
      // Global notifications
      prisma.notification.findMany({
        where: { targetType: 'ALL' },
        orderBy: { createdAt: 'desc' },
      }),
      // Specific notifications where user is recipient
      prisma.notification.findMany({
        where: {
          targetType: 'SPECIFIC',
          recipients: {
            some: { userId: payload.sub },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Combine notifications
    let allNotifications = [...globalNotifications, ...specificNotifications];

    // Remove duplicates (if any)
    const seen = new Set();
    allNotifications = allNotifications.filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });

    // 2. Get deleted notification IDs for this user
    const deletedStatuses = await prisma.notificationStatus.findMany({
      where: {
        userId: payload.sub,
        isDeleted: true,
      },
      select: { notificationId: true },
    });
    const deletedIds = new Set(deletedStatuses.map((s) => s.notificationId));

    // Filter out deleted notifications
    allNotifications = allNotifications.filter((n) => !deletedIds.has(n.id));

    // 3. Get read statuses
    const readStatuses = await prisma.notificationStatus.findMany({
      where: {
        userId: payload.sub,
        isRead: true,
      },
      select: { notificationId: true },
    });
    const readIds = new Set(readStatuses.map((s) => s.notificationId));

    // Add isRead flag to each notification
    let userNotifications = allNotifications.map((n) => ({
      ...n,
      isRead: readIds.has(n.id),
    }));

    // Apply unread filter
    if (filter === 'unread') {
      userNotifications = userNotifications.filter((n: any) => !n.isRead);
    }

    // Sort by createdAt desc
    userNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = userNotifications.length;
    const unreadCount = userNotifications.filter((n: any) => !n.isRead).length;

    // Apply pagination
    const notifications = userNotifications.slice(skip, skip + limit);

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
