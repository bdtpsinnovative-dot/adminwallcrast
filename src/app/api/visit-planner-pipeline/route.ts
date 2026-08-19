import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    const requestedUserId = request.nextUrl.searchParams.get('user_id');
    const targetUserId = requesterProfile?.role === 'admin' && requestedUserId
      ? requestedUserId
      : user.id;

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        company_id,
        companies (id, name, customer_type_id),
        order_items (
          product_category_id,
          order_item_projects (id, project_name, project_type_id)
        )
      `)
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw error;

    const companyMap = new Map<string, any>();
    for (const order of orders || []) {
      const company = Array.isArray(order.companies) ? order.companies[0] : order.companies;
      if (!company || !order.company_id) continue;
      const existing = companyMap.get(order.company_id) || {
        company,
        projects: [],
        count: 0,
        is_mine: true,
      };
      existing.count += 1;

      for (const item of order.order_items || []) {
        for (const project of item.order_item_projects || []) {
          const name = project.project_name?.trim();
          if (!name || name === '-' || name.includes('ไม่ระบุโครงการ')) continue;
          if (!existing.projects.some((saved: any) => saved.id === project.id)) {
            existing.projects.push({
              id: project.id,
              project_name: name,
              project_type_id: project.project_type_id,
              product_category_id: item.product_category_id,
              is_mine: true,
            });
          }
        }
      }
      companyMap.set(order.company_id, existing);
    }

    const pipeline = Array.from(companyMap.values()).sort((a, b) => b.count - a.count);
    return NextResponse.json({ pipeline, user_id: targetUserId });
  } catch (error: any) {
    console.error('[VisitPlannerPipeline] Error:', error);
    return NextResponse.json(
      { error: 'โหลด Pipeline ไม่สำเร็จ', details: error?.message || String(error) },
      { status: 500 },
    );
  }
}
