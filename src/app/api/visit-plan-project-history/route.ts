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

    const companyId = request.nextUrl.searchParams.get('company_id');
    if (!companyId) {
      return NextResponse.json({ error: 'กรุณาเลือกบริษัท' }, { status: 400 });
    }

    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    const isAdmin = requesterProfile?.role === 'admin';
    const requestedUserId = request.nextUrl.searchParams.get('user_id');
    const targetUserId = isAdmin && requestedUserId ? requestedUserId : user.id;

    let ordersQuery = supabase
      .from('orders')
      .select(`
        user_id,
        order_items (
          product_category_id,
          order_item_projects (id, project_name, project_type_id)
        )
      `)
      .eq('company_id', companyId)
      .limit(1000);
    let plansQuery = supabase
      .from('visit_plans')
      .select(`
        user_id, project_id, project_type_id, product_category_id,
        projects (id, project_name)
      `)
      .eq('company_id', companyId)
      .limit(1000);

    if (!isAdmin) {
      ordersQuery = ordersQuery.eq('user_id', targetUserId);
      plansQuery = plansQuery.eq('user_id', targetUserId);
    }

    const [ordersResult, plansResult] = await Promise.all([ordersQuery, plansQuery]);
    if (ordersResult.error) throw ordersResult.error;
    if (plansResult.error) throw plansResult.error;

    const projectMap = new Map<string, any>();
    const addProject = (project: any, ownerId: string | null, categoryId?: any, typeId?: any) => {
      const id = project?.id?.toString();
      const name = project?.project_name?.toString().trim();
      if (!id || !name || name === '-' || name.includes('ไม่ระบุโครงการ')) return;
      const existing = projectMap.get(id) || {
        id,
        project_name: name,
        project_type_id: project.project_type_id ?? typeId ?? null,
        product_category_id: categoryId ?? null,
        is_mine: false,
      };
      if (ownerId === targetUserId) existing.is_mine = true;
      if (!existing.project_type_id) existing.project_type_id = project.project_type_id ?? typeId ?? null;
      if (!existing.product_category_id) existing.product_category_id = categoryId ?? null;
      projectMap.set(id, existing);
    };

    for (const order of ordersResult.data || []) {
      for (const item of order.order_items || []) {
        for (const project of item.order_item_projects || []) {
          addProject(project, order.user_id, item.product_category_id);
        }
      }
    }
    for (const plan of plansResult.data || []) {
      const project = Array.isArray(plan.projects) ? plan.projects[0] : plan.projects;
      addProject(project, plan.user_id, plan.product_category_id, plan.project_type_id);
    }

    const projects = Array.from(projectMap.values()).sort((a, b) => {
      if (a.is_mine !== b.is_mine) return a.is_mine ? -1 : 1;
      return a.project_name.localeCompare(b.project_name, 'th');
    });
    return NextResponse.json({ company_id: companyId, user_id: targetUserId, projects });
  } catch (error: any) {
    console.error('[VisitPlanProjectHistory] Error:', error);
    return NextResponse.json(
      { error: 'โหลดประวัติโปรเจกต์ไม่สำเร็จ', details: error?.message || String(error) },
      { status: 500 },
    );
  }
}
