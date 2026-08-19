import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getAuthenticatedContext(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const token = authorization.slice('Bearer '.length);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  return { supabase, user, isAdmin: profile?.role === 'admin' };
}

async function resolveProjectId(supabase: any, projectId: unknown) {
  if (typeof projectId !== 'string' || !projectId) return null;
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle();
  if (error) throw error;
  return (data as { id?: string } | null)?.id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthenticatedContext(request);
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.planned_date) return NextResponse.json({ error: 'กรุณาเลือกวันที่เข้าพบ' }, { status: 400 });
    if (!body.company_id) return NextResponse.json({ error: 'กรุณาเลือกบริษัทก่อนบันทึกแผนงาน' }, { status: 400 });

    if (body.client_request_id) {
      const { data: existing, error } = await context.supabase
        .from('visit_plans')
        .select('*')
        .eq('client_request_id', body.client_request_id)
        .maybeSingle();
      if (error) throw error;
      if (existing) return NextResponse.json({ ...existing, already_created: true });
    }

    const projectId = await resolveProjectId(context.supabase, body.project_id);
    const targetUserId = context.isAdmin && body.user_id ? body.user_id : context.user.id;
    const { data, error } = await context.supabase
      .from('visit_plans')
      .insert({
        user_id: targetUserId,
        company_id: body.company_id,
        project_id: projectId,
        planned_date: body.planned_date,
        start_time: body.start_time || null,
        end_time: body.end_time || null,
        client_request_id: body.client_request_id || null,
        project_type_id: body.project_type_id || null,
        product_category_id: body.product_category_id || null,
        project_concept: body.project_concept || null,
        status: 'pending',
        is_deleted: false,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('[VisitPlans][POST] Error:', error);
    return NextResponse.json({ error: error?.message || 'บันทึกแผนงานไม่สำเร็จ' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthenticatedContext(request);
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const id = request.nextUrl.searchParams.get('id') || body.id;
    if (!id) return NextResponse.json({ error: 'ไม่พบรหัสแผนงานที่ต้องการแก้ไข' }, { status: 400 });
    if (!body.planned_date) return NextResponse.json({ error: 'กรุณาเลือกวันที่เข้าพบ' }, { status: 400 });
    if (!body.company_id) return NextResponse.json({ error: 'กรุณาเลือกบริษัทก่อนบันทึกแผนงาน' }, { status: 400 });

    const projectId = await resolveProjectId(context.supabase, body.project_id);
    const changes: Record<string, unknown> = {
      company_id: body.company_id,
      project_id: projectId,
      planned_date: body.planned_date,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      project_type_id: body.project_type_id || null,
      product_category_id: body.product_category_id || null,
      project_concept: body.project_concept || null,
    };
    if (context.isAdmin && body.user_id) changes.user_id = body.user_id;

    let query = context.supabase.from('visit_plans').update(changes).eq('id', id);
    if (!context.isAdmin) query = query.eq('user_id', context.user.id);
    const { data, error } = await query.select().maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'ไม่พบแผนงานนี้ หรือไม่มีสิทธิ์แก้ไข' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[VisitPlans][PATCH] Error:', error);
    return NextResponse.json({ error: error?.message || 'แก้ไขแผนงานไม่สำเร็จ' }, { status: 500 });
  }
}
