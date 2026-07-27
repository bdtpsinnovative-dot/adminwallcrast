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
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;

  if (!token) {
    redirect('/login');
  }

  // 🚀 Fetch Auth + all Master Data in 1 PARALLEL Promise.all call (eliminates 1.2s server waterfall)
  const [
    authResult,
    { data: profiles },
    { data: projectTypes },
    { data: productCategories },
    { data: teams },
    { data: customerTypes }
  ] = await Promise.all([
    supabase.auth.getUser(token),
    supabase.from('profiles').select('id, full_name, team_id, role'),
    supabase.from('project_types').select('id, name'),
    supabase.from('product_categories').select('id, name'),
    supabase.from('teams').select('id, team_name').order('team_name'),
    supabase.from('customer_types').select('id, name')
  ]);

  if (authResult.error || !authResult.data?.user) {
    redirect('/login');
  }

  const user = authResult.data.user;
  const currentProfile = profiles?.find((p: any) => p.id === user.id);
  const currentUserRole = currentProfile?.role || 'user';
  const currentUserTeamId = currentProfile?.team_id || null;

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