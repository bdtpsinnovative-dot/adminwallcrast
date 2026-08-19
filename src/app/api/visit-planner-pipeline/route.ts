import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const totalSlots = 50;

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const token = authorization.slice('Bearer '.length);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or Expired Token' }, { status: 401 });
    }

    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('role, team_id')
      .eq('id', user.id)
      .maybeSingle();
    const requestedUserId = request.nextUrl.searchParams.get('user_id');
    const isAdmin = requesterProfile?.role === 'admin';
    let targetUserId = user.id;
    let targetTeamId = requesterProfile?.team_id ?? null;

    if (requestedUserId && (isAdmin || requestedUserId === user.id)) {
      targetUserId = requestedUserId;
      if (requestedUserId !== user.id) {
        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('team_id')
          .eq('id', requestedUserId)
          .maybeSingle();
        targetTeamId = targetProfile?.team_id ?? targetTeamId;
      }
    }

    const fetchOrders = async (filter: (query: any) => any, limit: number) => {
      const { data, error } = await filter(
        supabase
          .from('orders')
          .select(`
            company_id,
            user_id,
            team_id,
            companies (id, name, customer_type_id),
            order_items (
              product_category_id,
              order_item_projects (id, project_name, project_type_id)
            )
          `)
          .order('created_at', { ascending: false })
          .limit(limit),
      );
      if (error) throw error;
      return data ?? [];
    };

    const globalFilter = targetTeamId
      ? (query: any) => query.neq('user_id', targetUserId).neq('team_id', targetTeamId)
      : (query: any) => query.neq('user_id', targetUserId);
    const [myOrders, teamOrders, globalOrders] = await Promise.all([
      fetchOrders((query) => query.eq('user_id', targetUserId), 1000),
      targetTeamId
        ? fetchOrders(
            (query) => query.eq('team_id', targetTeamId).neq('user_id', targetUserId),
            300,
          )
        : Promise.resolve([]),
      fetchOrders(globalFilter, 200),
    ]);

    const companyMap = new Map<string, any>();
    const addOrders = (
      orders: any[],
      source: { is_mine: boolean; is_team: boolean; is_global: boolean },
    ) => {
      for (const order of orders) {
        const company = Array.isArray(order.companies) ? order.companies[0] : order.companies;
        if (!company || !order.company_id) continue;
        const current = companyMap.get(order.company_id) ?? {
          company,
          projects: [],
          count: 0,
          is_mine: false,
          is_team: false,
          is_global: false,
        };
        current.count += 1;
        current.is_mine ||= source.is_mine;
        current.is_team ||= source.is_team;
        current.is_global ||= source.is_global;

        for (const item of order.order_items ?? []) {
          for (const project of item.order_item_projects ?? []) {
            const name = project.project_name?.trim();
            if (!name || name === '-' || name.includes('ไม่ระบุโครงการ')) continue;
            const savedProject = current.projects.find(
              (saved: any) => saved.project_name === name,
            );
            if (!savedProject) {
              current.projects.push({
                id: project.id,
                project_name: name,
                project_type_id: project.project_type_id,
                product_category_id: item.product_category_id,
                count: 1,
                is_mine: source.is_mine,
                is_team: source.is_team,
                is_global: source.is_global,
              });
            } else {
              savedProject.count = (savedProject.count || 0) + 1;
              if (source.is_mine) savedProject.is_mine = true;
              if (source.is_team) savedProject.is_team = true;
              if (source.is_global) savedProject.is_global = true;
            }
          }
        }
        companyMap.set(order.company_id, current);
      }
    };

    addOrders(myOrders, { is_mine: true, is_team: false, is_global: false });
    addOrders(teamOrders, { is_mine: false, is_team: true, is_global: false });
    addOrders(globalOrders, { is_mine: false, is_team: false, is_global: true });

    const allCompanies = Array.from(companyMap.values());
    const mine = allCompanies
      .filter((item) => item.is_mine)
      .map((item) => ({ ...item, is_team: false, is_global: false }))
      .sort((a, b) => b.count - a.count);
    const team = allCompanies
      .filter((item) => !item.is_mine && item.is_team)
      .sort((a, b) => b.count - a.count);
    const global = allCompanies
      .filter((item) => !item.is_mine && !item.is_team && item.is_global)
      .sort((a, b) => b.count - a.count);

    // กติกาเดียวกับ New Record: ของตนเองก่อน, ตามด้วยทีมและทั่วระบบ
    // เพื่อให้พนักงานใหม่มีรายการแนะนำสูงสุด 50 บริษัทเสมอ.
    const pipeline: any[] = [];
    if (myOrders.length >= 300) {
      pipeline.push(...mine.slice(0, totalSlots));
    } else if (myOrders.length >= 100) {
      pipeline.push(...mine.slice(0, 45), ...team.slice(0, 5));
    } else if (myOrders.length >= 50) {
      pipeline.push(...mine.slice(0, 40), ...team.slice(0, 10));
    } else {
      pipeline.push(...mine);
      pipeline.push(...team.slice(0, Math.max(0, totalSlots - pipeline.length)));
      pipeline.push(...global.slice(0, Math.max(0, totalSlots - pipeline.length)));
    }

    return NextResponse.json({ pipeline, user_id: targetUserId });
  } catch (error: any) {
    console.error('[VisitPlannerPipeline] Error:', error);
    return NextResponse.json(
      { error: 'โหลด Pipeline ไม่สำเร็จ', details: error?.message || String(error) },
      { status: 500 },
    );
  }
}
