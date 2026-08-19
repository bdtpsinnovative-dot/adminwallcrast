import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getAdminSupabase(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const token = authorization.slice('Bearer '.length);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  return profile?.role === 'admin' ? supabase : null;
}

function planIds(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0)))
    : [];
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getAdminSupabase(request);
    if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const ids = planIds(body.ids);
    if (ids.length === 0 || typeof body.is_deleted !== 'boolean') {
      return NextResponse.json({ error: 'ข้อมูลแผนงานไม่ถูกต้อง' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('visit_plans')
      .update({ is_deleted: body.is_deleted })
      .in('id', ids)
      .select('id, is_deleted');
    if (error) throw error;
    if ((data || []).length !== ids.length) {
      return NextResponse.json({ error: 'พบแผนงานไม่ครบทุกรายการ จึงไม่อัปเดตข้อมูลบนหน้าจอ' }, { status: 409 });
    }

    return NextResponse.json({ plans: data });
  } catch (error: any) {
    console.error('[VisitPlansTrash][PATCH] Error:', error);
    return NextResponse.json({ error: error?.message || 'ย้ายแผนงานไม่สำเร็จ' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getAdminSupabase(request);
    if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const ids = planIds(body.ids);
    if (ids.length === 0) return NextResponse.json({ error: 'ข้อมูลแผนงานไม่ถูกต้อง' }, { status: 400 });

    const { data, error } = await supabase
      .from('visit_plans')
      .delete()
      .in('id', ids)
      .eq('is_deleted', true)
      .select('id');
    if (error) throw error;
    if ((data || []).length !== ids.length) {
      return NextResponse.json({ error: 'ลบถาวรได้เฉพาะแผนงานที่อยู่ในถังขยะครบทุกรายการ' }, { status: 409 });
    }

    return NextResponse.json({ deleted_ids: data.map(plan => plan.id) });
  } catch (error: any) {
    console.error('[VisitPlansTrash][DELETE] Error:', error);
    return NextResponse.json({ error: error?.message || 'ลบแผนงานถาวรไม่สำเร็จ' }, { status: 500 });
  }
}
