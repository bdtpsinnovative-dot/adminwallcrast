import { NextRequest, NextResponse } from 'next/server';

const VISIT_PLANS_API_URL = 'https://wallcraftthailand.com/api/v1/visit-plans';

async function forwardVisitPlanRequest(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetUrl = new URL(VISIT_PLANS_API_URL);
    const id = request.nextUrl.searchParams.get('id');
    if (id) targetUrl.searchParams.set('id', id);

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: await request.text(),
      cache: 'no-store',
    });

    const responseBody = await response.text();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error: any) {
    console.error('[VisitPlansProxy] Error:', error);
    return NextResponse.json(
      { error: 'เชื่อมต่อ API แผนงานไม่สำเร็จ', details: error?.message || String(error) },
      { status: 502 },
    );
  }
}

export const POST = forwardVisitPlanRequest;
export const PATCH = forwardVisitPlanRequest;
