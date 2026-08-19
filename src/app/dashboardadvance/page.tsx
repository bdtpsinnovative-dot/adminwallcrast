// src/app/dashboardadvance/page.tsx
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardClientContainer from '@/components/DashboardClientContainer';

export const dynamic = 'force-dynamic';

const initialDataTimeoutMs = 15_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Dashboard Advance data timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    }),
  ]);
}

export default async function DashboardAdvancePage({
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

  try {
    // Fetch auth and master data together, but never leave the production page
    // suspended forever if the Supabase request or an expired session stalls.
    const [
      authResult,
      { data: profiles },
      { data: projectTypes },
      { data: productCategories },
      { data: teams },
      { data: customerTypes },
    ] = await withTimeout(
      Promise.all([
        supabase.auth.getUser(token),
        supabase
          .from('profiles')
          .select('id, full_name, team_id, role, email, avatar_url'),
        supabase.from('project_types').select('id, name'),
        supabase.from('product_categories').select('id, name'),
        supabase.from('teams').select('id, team_name').order('team_name'),
        supabase.from('customer_types').select('id, name'),
      ]),
      initialDataTimeoutMs,
    );

    if (authResult.error || !authResult.data?.user) {
      redirect('/login');
    }

    const user = authResult.data.user;
    const currentProfile = profiles?.find((p: any) => p.id === user.id);
    const currentUserRole = currentProfile?.role || 'user';
    const currentUserTeamId = currentProfile?.team_id || null;

    return (
      <DashboardClientContainer
        variant="advance"
        currentUserRole={currentUserRole}
        currentUserTeamId={currentUserTeamId}
        profiles={profiles || []}
        projectTypes={projectTypes || []}
        productCategories={productCategories || []}
        teams={teams || []}
        customerTypes={customerTypes || []}
      />
    );
  } catch (error: any) {
    if (
      error?.digest?.startsWith('NEXT_REDIRECT') ||
      error?.message === 'NEXT_REDIRECT'
    ) {
      throw error;
    }
    console.error(
      '⚠️ [DashboardAdvancePage] Failed to fetch initial data from Supabase:',
      error?.message || error,
    );
    redirect('/login');
  }
}
