// src/app/dashboard/checkins/[userId]/page.tsx
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowLeft, MapPin, Calendar, Clock, Map, Image as ImageIcon, FileText, Smartphone, Users, User, Building2 } from 'lucide-react';
import ImageGallery from '@/components/ImageGallery';
import UserCheckInFilter from '@/components/UserCheckInFilter';
import ExpandableNote from '@/components/ExpandableNote';
import EditCheckInModal from '@/components/EditCheckInModal';
import ExportExcelButton from '@/components/ExportExcelButton';
import CheckInMap from '@/components/CheckInMap';
import CheckInInfiniteList from '@/components/CheckInInfiniteList';

export const dynamic = 'force-dynamic';

export default async function UserCheckInHistoryPage({ 
  params, 
  searchParams 
}: { 
  params: { userId: string },
  searchParams: { start?: string; end?: string; source?: string; minArea?: string; maxArea?: string; role?: string; company?: string; } 
}) {
  const resolvedParams = await Promise.resolve(params);
  const userId = resolvedParams.userId;
  const resolvedSearchParams = await Promise.resolve(searchParams);

  // ดึงอีเมลจากระบบ Auth ของ Supabase โดยตรง
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });
  const authUsers = authData?.users || [];
  const userEmailMap: Record<string, string> = {};
  authUsers.forEach(u => {
    userEmailMap[u.id] = u.email || '';
  });

  let startIso = '';
  let endIso = '';
  if (resolvedSearchParams?.start) startIso = new Date(`${resolvedSearchParams.start}T00:00:00+07:00`).toISOString();
  if (resolvedSearchParams?.end) endIso = new Date(`${resolvedSearchParams.end}T23:59:59.999+07:00`).toISOString();
  
  const filterSource = resolvedSearchParams?.source || 'ALL'; 
  const minAreaFilter = resolvedSearchParams?.minArea ? Number(resolvedSearchParams.minArea) : null;
  const maxAreaFilter = resolvedSearchParams?.maxArea ? Number(resolvedSearchParams.maxArea) : null;
  const roleFilter = resolvedSearchParams?.role || 'ALL';
  
  const filterCompany = resolvedSearchParams?.company ? resolvedSearchParams.company.trim() : '';
  const normalizeText = (text: string) => text ? text.replace(/\s+/g, '').toLowerCase() : '';
  const targetCompanyStr = normalizeText(filterCompany);

  let userName = 'ทีมเซลส์ทั้งหมด (All Sales)';
  if (userId !== 'all') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    if (profile) userName = profile.full_name;
  }

  const { data: categoriesData } = await supabase
    .from('product_categories')
    .select('id, name')
    .order('name');
  const categories = categoriesData || [];

  // ✨ อัปเดต Query ดึงข้อมูลตาราง teams (team_name) มาด้วย
  let query = supabase
    .from('orders')
    .select(`
      id, created_at, audit_log, phone, customer_name, source, user_id,
      companies (name),
      profiles (full_name, email),
      teams (team_name), 
      order_items (
        id, 
        product_category_id, 
        images, 
        note,
        interest_level,
        order_item_projects (
          id, 
          project_name, area_sqm, is_deleted, project_note,
          account_developer, contact_developer,
          account_architecture, contact_architecture,
          account_interior, contact_interior,
          account_contractor, contact_contractor,
          project_types (name)
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (userId !== 'all') {
    query = query.eq('user_id', userId);
  }

  if (startIso) query = query.gte('created_at', startIso);
  if (endIso) query = query.lte('created_at', endIso);

  const { data: historyData, error } = await query;

  if (error) {
    console.error("Fetch History Error:", error.message);
  }

  const ordersList: any[] = [];
  let totalAppCount = 0;
  let totalCsvCount = 0;
  let totalProjectsCount = 0;

  historyData?.forEach(order => {
    let dbCompanyName = '';
    if (Array.isArray(order.companies)) {
      dbCompanyName = order.companies[0]?.name || '';
    } else if (order.companies) {
      dbCompanyName = (order.companies as any).name || '';
    }

    let dbSalesName = '';
    let dbSalesEmail = userEmailMap[order.user_id] || '';
    if (Array.isArray(order.profiles)) {
      dbSalesName = order.profiles[0]?.full_name || '';
    } else if (order.profiles) {
      dbSalesName = (order.profiles as any).full_name || '';
    }

    // ✨ ดึงชื่อทีมของ Order นี้มาเก็บไว้ส่งให้ Excel
    let dbTeamName = '';
    if (Array.isArray(order.teams)) {
      dbTeamName = order.teams[0]?.team_name || '';
    } else if (order.teams) {
      dbTeamName = (order.teams as any).team_name || '';
    }

    if (targetCompanyStr && normalizeText(dbCompanyName) !== targetCompanyStr) {
      return; 
    }

    const auditLog = order.audit_log as any;
    const isCsv = !auditLog;

    if (filterSource === 'APP' && isCsv) return;
    if (filterSource === 'CSV' && !isCsv) return;
    
    const validProjects: any[] = [];
    
    (order.order_items || []).forEach((item: any) => {
      (item.order_item_projects || [])
        .filter((proj: any) => proj.is_deleted !== true)
        .forEach((proj: any) => {
          const projArea = Number(proj.area_sqm) || 0;
          if (minAreaFilter !== null && projArea < minAreaFilter) return;
          if (maxAreaFilter !== null && projArea > maxAreaFilter) return;

          if (roleFilter !== 'ALL') {
            const hasDev = !!proj.account_developer || !!proj.contact_developer;
            const hasArch = !!proj.account_architecture || !!proj.contact_architecture;
            const hasInt = !!proj.account_interior || !!proj.contact_interior;
            const hasCont = !!proj.account_contractor || !!proj.contact_contractor;

            if (roleFilter === 'developer' && !hasDev) return;
            if (roleFilter === 'architect' && !hasArch) return;
            if (roleFilter === 'interior' && !hasInt) return;
            if (roleFilter === 'contractor' && !hasCont) return;
          }

          let imagesArray: string[] = [];
          if (Array.isArray(item.images)) {
            imagesArray = item.images;
          }

          const matchedCategory = categories.find(c => c.id === item.product_category_id);
          const categoryName = matchedCategory ? matchedCategory.name : 'ไม่ระบุหมวดหมู่';

          validProjects.push({
            id: proj.id || `${proj.project_name}-${order.id}`,
            orderItemId: item.id,
            projectId: proj.id,
            categoryId: item.product_category_id,
            categoryName: categoryName,
            projectName: proj.project_name || 'ไม่ระบุชื่อโปรเจกต์',
            projectType: proj.project_types?.name || '-',
            area: proj.area_sqm,
            images: imagesArray,
            lat: auditLog?.location?.lat,
            lng: auditLog?.location?.lng,
            note: item.note || proj.project_note || '',
            interestLevel: item.interest_level, 
            device: auditLog?.device?.brand ? `${auditLog.device.brand} ${auditLog.device.model}` : 'ไม่ระบุอุปกรณ์',
            stakeholders: {
              devAcc: proj.account_developer,
              devCont: proj.contact_developer,
              archAcc: proj.account_architecture,
              archCont: proj.contact_architecture,
              intAcc: proj.account_interior,
              intCont: proj.contact_interior,
              contAcc: proj.account_contractor,
              contCont: proj.contact_contractor
            }
          });
        });
    });

    if (validProjects.length > 0) {
      if (isCsv) totalCsvCount += validProjects.length;
      else totalAppCount += validProjects.length;
      totalProjectsCount += validProjects.length;

      const dateUTC = new Date(order.created_at);
      const dateStr = dateUTC.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = dateUTC.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) + ' น.';

      ordersList.push({
        orderId: order.id,
        salesName: dbSalesName || 'ไม่ระบุเซลส์', 
        salesEmail: dbSalesEmail || '',
        teamName: dbTeamName || 'ไม่มีทีม', 
        customerName: order.customer_name || 'ไม่ระบุชื่อลูกค้า',
        companyName: dbCompanyName || 'ลูกค้าทั่วไป (B2C)', 
        phone: order.phone || '-',
        source: order.source, // ✨ ตรวจสอบให้แน่ใจว่ามีบรรทัดนี้ส่งไปให้กราฟและปุ่ม Excel ด้วย
        isCsv: isCsv,
        date: dateStr,
        time: timeStr,
        timestamp: dateUTC.getTime(),
        projects: validProjects
      });
    }
  });

  ordersList.sort((a, b) => b.timestamp - a.timestamp);

  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      
      <div className="mb-6 max-w-[1600px] w-[96%] mx-auto">
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-4"
        >
          <ArrowLeft size={16} /> กลับไปหน้าภาพรวมหลัก
        </Link>

        {filterCompany && (
          <div className="mb-4 bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between shadow-sm gap-3">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <Building2 size={20} className="text-indigo-600" />
              <span>กางลายแทงการเข้าพบของบริษัท: <span className="text-indigo-600 bg-white border border-indigo-100 px-3 py-1.5 rounded-lg ml-1 font-black shadow-sm text-base">{filterCompany}</span></span>
            </div>
            <Link 
              href={`/dashboard/checkins/${userId}`}
              className="text-xs font-bold bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 transition-all shadow-sm w-fit"
            >
              ✕ ล้างตัวกรอง (ดูทั้งหมด)
            </Link>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-md bg-slate-700 text-white flex items-center justify-center font-bold text-2xl shadow-sm shrink-0">
              {userId === 'all' ? <Users size={24} /> : userName.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                ประวัติลงพื้นที่
              </h1>
              <p className="text-slate-500 text-sm mt-1">พนักงาน: <span className="font-semibold text-slate-700">{userName}</span></p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200 overflow-x-auto shrink-0">
            <div className="flex flex-col items-center px-4 border-r border-slate-200 min-w-[80px]">
              <span className="text-[10px] uppercase font-bold text-slate-500">ออเดอร์</span>
              <span className="text-lg font-black text-slate-800">{ordersList.length}</span>
            </div>
            <div className="flex flex-col items-center px-4 border-r border-slate-200 min-w-[80px]">
              <span className="text-[10px] uppercase font-bold text-slate-500">โปรเจกต์</span>
              <span className="text-lg font-black text-slate-800">{totalProjectsCount}</span>
            </div>
            <div className="flex flex-col items-center px-4 border-r border-slate-200 min-w-[80px]">
              <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Smartphone size={10}/> App</span>
              <span className="text-lg font-black text-slate-800">{totalAppCount}</span>
            </div>
            <div className="flex flex-col items-center px-4 min-w-[80px]">
              <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><FileText size={10}/> CSV</span>
              <span className="text-lg font-black text-slate-800">{totalCsvCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] w-[96%] mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex-1 w-full overflow-x-auto">
            <UserCheckInFilter />
          </div>
          <ExportExcelButton ordersData={ordersList} />
        </div>

        <div className="mt-6">
          <CheckInInfiniteList ordersList={ordersList} userId={userId} categories={categories} />
        </div>
      </div>
    </main>
  );
}