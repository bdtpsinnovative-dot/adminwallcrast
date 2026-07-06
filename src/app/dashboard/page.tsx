// src/app/dashboard/page.tsx
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardClientContainer from '@/components/DashboardClientContainer';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: {
    start?: string; end?: string; range?: string;
    sales?: string; projectType?: string; productCategory?: string;
    customerType?: string; 
    minArea?: string; maxArea?: string; source?: string; team?: string;
  };
}) {
  const masterDataPromise = Promise.all([
    supabase.from('profiles').select('id, full_name, team_id'),
    supabase.from('project_types').select('id, name'),
    supabase.from('product_categories').select('id, name'),
    supabase.from('teams').select('id, team_name').order('team_name'),
    supabase.from('customer_types').select('id, name')
  ]);

  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  
  // 1. ถ้าไม่มี Cookie เลย เตะกลับหน้า Login
  if (!token) {
    redirect('/login');
  }

  // 2. เอา Token ไปเช็คกับ Supabase ว่ากุญแจยังไม่หมดอายุใช่ไหม?
  const { data, error } = await supabase.auth.getUser(token);

  // 🛑 3. จุดสำคัญ: ถ้า Token หมดอายุ (Error) หรือไม่ได้ข้อมูล User ให้เตะกลับหน้า Login ทันที!
  if (error || !data?.user) {
    redirect('/login');
  }

  const user = data.user;
  let currentUserRole = 'user';
  let currentUserTeamId = null;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, team_id')
      .eq('id', user.id)
      .single();
      
    if (profile) {
      currentUserRole = profile.role;
      currentUserTeamId = profile.team_id;
    }
  }

  const [
    { data: profiles },
    { data: projectTypes },
    { data: productCategories },
    { data: teams },
    { data: customerTypes }
  ] = await masterDataPromise;

  return (
    <DashboardClientContainer
      currentUserRole={currentUserRole}
      currentUserTeamId={currentUserTeamId}
      profiles={profiles || []}
      projectTypes={projectTypes || []}
      productCategories={productCategories || []}
      teams={teams || []}
      customerTypes={customerTypes || []}
    />
  );
}