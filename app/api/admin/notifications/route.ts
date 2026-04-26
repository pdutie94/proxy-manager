import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

// POST /api/admin/notifications - Send notification to customer(s)
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { target, userIds, title, message } = await request.json();

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      );
    }

    let createdCount = 0;

    if (target === 'all') {
      // Send to all active customers - targetType = ALL, no recipients records
      await prisma.notification.create({
        data: {
          targetType: 'ALL',
          type: 'ADMIN_MESSAGE',
          title,
          message,
        },
      });

      const customers = await prisma.user.findMany({
        where: {
          role: 'CUSTOMER',
          isActive: true,
        },
        select: { id: true },
      });

      createdCount = customers.length;
    } else if (target === 'specific' && userIds && userIds.length > 0) {
      // Send to specific users - targetType = SPECIFIC, create recipient records
      await prisma.notification.create({
        data: {
          targetType: 'SPECIFIC',
          type: 'ADMIN_MESSAGE',
          title,
          message,
          recipients: {
            create: userIds.map((id: number) => ({ userId: id })),
          },
        },
      });

      createdCount = userIds.length;
    } else {
      return NextResponse.json(
        { error: 'Invalid target or userIds' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${createdCount} user(s)`,
      sentCount: createdCount,
    });
  } catch (error) {
    console.error('Send notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

// GET /api/admin/notifications - List all notifications with pagination
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const skip = (page - 1) * limit;

    // Fetch notifications with recipients and all users
    const [notifications, total, users] = await Promise.all([
      prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          recipients: true, // Only get userId, no user relation
        },
      }),
      prisma.notification.count(),
      prisma.user.findMany({
        where: { role: 'CUSTOMER' },
        select: { id: true, name: true, email: true },
      }),
    ]);

    // Create user map for quick lookup
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Enrich notifications with recipient info
    const enrichedNotifications = notifications.map((notification) => {
      let recipients;
      
      if (notification.targetType === 'ALL') {
        // All users
        recipients = { type: 'all', count: users.length, users: users };
      } else {
        // Specific users from recipients - look up in userMap
        const recipientUsers = notification.recipients
          .map((r: any) => userMap.get(r.userId))
          .filter(Boolean); // Remove undefined
        recipients = { type: 'specific', count: recipientUsers.length, users: recipientUsers };
      }

      return {
        ...notification,
        recipients,
      };
    });

    return NextResponse.json({
      notifications: enrichedNotifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
