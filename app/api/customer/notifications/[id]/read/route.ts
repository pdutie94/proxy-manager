import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// PATCH /api/customer/notifications/[id]/read - Mark notification as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get notification first
    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
      include: { recipients: true },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this notification
    if (notification.targetType === 'SPECIFIC') {
      const recipientIds = notification.recipients.map((r: any) => r.userId);
      if (!recipientIds.includes(payload.sub)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Upsert notification status (insert if not exists, update if exists)
    await prisma.notificationStatus.upsert({
      where: {
        userId_notificationId: {
          userId: payload.sub,
          notificationId: params.id,
        },
      },
      update: {
        isRead: true,
        readAt: new Date(),
      },
      create: {
        userId: payload.sub,
        notificationId: params.id,
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
