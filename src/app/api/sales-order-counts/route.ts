import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PAGE_SIZE = 1000;

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const token = authorization.slice('Bearer '.length);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or Expired Token' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const counts: Record<string, number> = {};
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('orders')
        .select('user_id')
        .not('user_id', 'is', null)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;

      for (const order of data || []) {
        if (order.user_id) counts[order.user_id] = (counts[order.user_id] || 0) + 1;
      }
      if (!data || data.length < PAGE_SIZE) break;
    }

    return NextResponse.json({ counts });
  } catch (error: any) {
    console.error('[SalesOrderCounts] Error:', error);
    return NextResponse.json(
      { error: 'โหลดจำนวนออเดอร์ของเซลส์ไม่สำเร็จ', details: error?.message || String(error) },
      { status: 500 },
    );
  }
}
