import { NextRequest, NextResponse } from 'next/server';
import { refreshToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { refreshToken: token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      );
    }

    const result = await refreshToken(token);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { error: 'Invalid refresh token' },
      { status: 401 }
    );
  }
}
