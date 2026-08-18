'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import DashboardDateFilter from '@/components/DashboardDateFilter';
import { Trophy, BarChart2, Activity, Sigma, PieChart } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart as RePie, Pie, Cell,
} from 'recharts';

const COLORS = ['#4f46e5', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#f59e0b', '#f97316'];

// ── Inner component (useSearchParams requires Suspense boundary) ───────────────
function ProjectReportsContent() {
  const searchParams = useSearchParams();

  // ── Read all URL filter params ─────────────────────────────────────────────
  const urlStart          = searchParams.get('start')           || '';
  const urlEnd            = searchParams.get('end')             || '';
  const salesFilter       = searchParams.get('sales')           || 'ALL';
  const teamFilter        = searchParams.get('team')            || 'ALL';
  const projectTypeFilter = searchParams.get('projectType')     || 'ALL';
  const productCatFilter  = searchParams.get('productCategory') || 'ALL';
  const sourceFilter      = searchParams.get('source')          || 'ALL';
  const minAreaFilter     = searchParams.get('minArea')         || '';
  const maxAreaFilter     = searchParams.get('maxArea')         || '';

  const [loading, setLoading]             = useState(true);
  const [dashboardData, setDashboardData] = useState<any[]>([]);
  const [totals, setTotals]               = useState<any>(null);
  const [projectList, setProjectList]     = useState<any[]>([]);
  const [searchProject, setSearchProject] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'top' | 'no_user'>('all');
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
  const [showOrderLinks, setShowOrderLinks] = useState(false);

  // Lists passed to DashboardDateFilter as props
  const [salesList, setSalesList]           = useState<any[]>([]);
  const [projectTypes, setProjectTypes]     = useState<any[]>([]);
  const [productCategories, setProductCats] = useState<any[]>([]);
  const [teams, setTeams]                   = useState<any[]>([]);
  const [customerTypes, setCustomerTypes]   = useState<any[]>([]); // 🌟 1. เพิ่ม State เก็บกลุ่มประเภทลูกค้า

  // ── Fetch filter-option lists once ────────────────────────────────────────
  useEffect(() => {
    const fetchLists = async () => {
      const [profRes, ptRes, pcRes, teamRes, ctRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').order('full_name'),
        supabase.from('project_types').select('id, name'),
        supabase.from('product_categories').select('id, name'),
        supabase.from('teams').select('id, team_name'),
        supabase.from('customer_types').select('id, name'), // 🌟 2. ดึงข้อมูล customer_types เพิ่มเติม
      ]);
      // Add special NO_USER option at top of sales list
      setSalesList([
        { id: 'NO_USER', full_name: '⚠️ ไม่มีผู้รับผิดชอบ (No User)' },
        ...(profRes.data || []),
      ]);
      setProjectTypes(ptRes.data || []);
      setProductCats(pcRes.data || []);
      setTeams(teamRes.data || []);
      setCustomerTypes(ctRes.data || []); // 🌟 3. จ่ายเข้า State หน้าบ้าน
    };
    fetchLists();
  }, []);

  // ── Main data fetch (reruns whenever URL filters change) ──────────────────
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const fetchAllRecords = async (table: string, q: string) => {
          let all: any[] = [];
          let from = 0;
          const step = 1000;
          while (true) {
            const { data, error } = await supabase.from(table).select(q).range(from, from + step - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            all = all.concat(data);
            if (data.length < step) break;
            from += step;
          }
          return all;
        };

        const [allCats, allComps, allOrders, allProfilesRaw] = await Promise.all([
          fetchAllRecords('customer_types', 'id, name'),
          fetchAllRecords('companies', 'id, name, customer_type_id'),
          fetchAllRecords(
            'orders',
            'id, company_id, customer_type_id, user_id, team_id, source, created_at, customer_name, phone,' +
            'order_items(id, product_category_id, note, interest_level,' +
            'order_item_projects(id, is_deleted, is_important, project_name, area_sqm, created_at, project_type_id,' +
            'account_developer, contact_developer, account_architecture, contact_architecture,' +
            'account_interior, contact_interior, account_contractor, contact_contractor))',
          ),
          fetchAllRecords('profiles', 'id, full_name'),
        ]);

        // Lookup maps
        const profileMap: Record<string, string> = {};
        allProfilesRaw.forEach((p: any) => { profileMap[p.id] = p.full_name || 'ไม่ระบุชื่อ'; });
        const catNameMap: Record<string, string> = {};
        allCats.forEach((c: any) => { catNameMap[c.id] = c.name; });
        const compMap: Record<string, any> = {};
        allComps.forEach((c: any) => { compMap[c.id] = c; });

        // ── Filter helpers ─────────────────────────────────────────────────
        const inDateRange = (dateStr: string | null) => {
          if (!dateStr) return true;
          const d = dateStr.slice(0, 10);
          if (urlStart && d < urlStart) return false;
          if (urlEnd   && d > urlEnd)   return false;
          return true;
        };

        const passOrderFilter = (order: any) => {
          if (!inDateRange(order.created_at)) return false;
          if (sourceFilter !== 'ALL' && order.source !== sourceFilter) return false;
          if (teamFilter   !== 'ALL' && order.team_id !== teamFilter)  return false;
          if (salesFilter === 'NO_USER') {
            if (order.user_id) return false;
          } else if (salesFilter !== 'ALL') {
            if (order.user_id !== salesFilter) return false;
          }
          return true;
        };

        const passProjectFilter = (p: any) => {
          if (p.is_deleted === true) return false;
          if (projectTypeFilter !== 'ALL' && p.project_type_id !== projectTypeFilter) return false;
          const area = p.area_sqm || 0;
          if (minAreaFilter && area < parseFloat(minAreaFilter)) return false;
          if (maxAreaFilter && area > parseFloat(maxAreaFilter)) return false;
          return true;
        };

        // ── catMap for Leaderboard ─────────────────────────────────────────
        const catMap: Record<string, any> = {};
        allCats.forEach((c: any) => { catMap[c.id] = { id: c.id, name: c.name, companies: {} }; });
        catMap['uncategorized'] = { id: 'uncategorized', name: 'ไม่มีหมวดหมู่ (Uncategorized)', companies: {} };
        allComps.forEach((comp: any) => {
          const catId = comp.customer_type_id || 'uncategorized';
          if (!catMap[catId]) catMap[catId] = { id: catId, name: 'หมวดหมู่อื่นๆ', companies: {} };
          catMap[catId].companies[comp.id] = { ...comp, projectCount: 0 };
        });

        // ── Build detail project list + leaderboard counts ─────────────────
        const rawProjects: any[] = [];

        allOrders.forEach((order: any) => {
          if (!passOrderFilter(order)) return;

          const userName    = order.user_id ? (profileMap[order.user_id] || 'ไม่พบชื่อ') : null;
          const comp        = order.company_id ? compMap[order.company_id] : null;
          const companyName = comp ? comp.name : null;
          const catId       = comp ? comp.customer_type_id : order.customer_type_id;
          const catName     = catId ? (catNameMap[catId] || null) : null;
          const targetCatId = catId || 'uncategorized';

          let pCount = 0;

          if (order.order_items) {
            order.order_items.forEach((item: any) => {
              // product category filter at item level
              if (productCatFilter !== 'ALL' && item.product_category_id !== productCatFilter) return;

              if (item.order_item_projects) {
                item.order_item_projects.forEach((p: any) => {
                  // Push ALL projects to detail table (active + deleted)
                  rawProjects.push({
                    id:                   p.id,
                    order_id:             order.id,
                    order_item_id:        item.id,
                    project_name:         p.project_name || null,
                    is_deleted:           p.is_deleted === true,
                    is_important:         p.is_important === true,
                    area_sqm:             p.area_sqm || 0,
                    created_at:           p.created_at,
                    user_name:            userName,
                    user_id:              order.user_id,
                    company_name:         companyName,
                    cat_name:             catName,
                    project_type_id:      p.project_type_id,
                    customer_name:        order.customer_name || null,
                    phone:                order.phone || null,
                    source:               order.source || null,
                    product_category_id:  item.product_category_id || null,
                    note:                 item.note || null,
                    interest_level:       item.interest_level || null,
                    account_developer:    p.account_developer || null,
                    contact_developer:    p.contact_developer || null,
                    account_architecture: p.account_architecture || null,
                    contact_architecture: p.contact_architecture || null,
                    account_interior:     p.account_interior || null,
                    contact_interior:     p.contact_interior || null,
                    account_contractor:   p.account_contractor || null,
                    contact_contractor:   p.contact_contractor || null,
                  });

                  // Leaderboard: count only active projects that pass all filters
                  if (passProjectFilter(p)) pCount++;
                });
              }
            });
          }

          if (pCount === 0) return;

          if (!catMap[targetCatId]) catMap[targetCatId] = { id: targetCatId, name: 'หมวดหมู่อื่นๆ', companies: {} };
          const targetCompId = order.company_id;
          if (targetCompId && catMap[targetCatId]?.companies[targetCompId]) {
            catMap[targetCatId].companies[targetCompId].projectCount += pCount;
          } else {
            const mockId = 'mock-' + targetCatId;
            if (!catMap[targetCatId].companies[mockId]) {
              catMap[targetCatId].companies[mockId] = {
                id: mockId, name: 'ลูกค้าทั่วไป (ไม่ระบุบริษัท)', projectCount: 0, isMock: true,
              };
            }
            catMap[targetCatId].companies[mockId].projectCount += pCount;
          }
        });

        // Sort detail list: Active first → newest, Deleted last
        rawProjects.sort((a, b) => {
          if (a.is_deleted !== b.is_deleted) return a.is_deleted ? 1 : -1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setProjectList(rawProjects);

        // ── Leaderboard stats ──────────────────────────────────────────────
        const processed = Object.values(catMap).map((cat: any) => {
          const comps       = Object.values(cat.companies) as any[];
          const actual      = comps.filter((c: any) => !c.isMock || c.projectCount > 0);
          const total       = actual.length;
          const active      = actual.filter((c: any) => c.projectCount > 0).length;
          const inactive    = total - active;
          const projectCount = actual.reduce((s: number, c: any) => s + c.projectCount, 0);
          return {
            id: cat.id, name: cat.name, total, active, inactive, projectCount,
            activeRate:   total > 0 ? parseFloat(((active   / total) * 100).toFixed(1)) : 0,
            inactiveRate: total > 0 ? parseFloat(((inactive / total) * 100).toFixed(1)) : 0,
          };
        }).filter(c => c.total > 0 || c.projectCount > 0)
          .sort((a, b) => b.projectCount - a.projectCount);

        const grand = processed.reduce(
          (acc, c) => ({ total: acc.total + c.total, active: acc.active + c.active, inactive: acc.inactive + c.inactive, projectCount: acc.projectCount + c.projectCount }),
          { total: 0, active: 0, inactive: 0, projectCount: 0 },
        );
        setDashboardData(processed);
        setTotals({
          ...grand,
          activeRate:   grand.total > 0 ? parseFloat(((grand.active   / grand.total) * 100).toFixed(1)) : 0,
          inactiveRate: grand.total > 0 ? parseFloat(((grand.inactive / grand.total) * 100).toFixed(1)) : 0,
        });

      } catch (err) {
        console.error('Fetch Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [urlStart, urlEnd, salesFilter, teamFilter, projectTypeFilter, productCatFilter, sourceFilter, minAreaFilter, maxAreaFilter]);

  // ── Computed: type lookup map ──────────────────────────────────────────────
  const typeMap = useMemo(() => {
    const m: Record<string, string> = {};
    projectTypes.forEach((t: any) => { m[t.id] = t.name; });
    return m;
  }, [projectTypes]);

  // ── Computed: product category lookup map ─────────────────────────────────
  const productCatMap = useMemo(() => {
    const m: Record<string, string> = {};
    productCategories.forEach((c: any) => { m[c.id] = c.name; });
    return m;
  }, [productCategories]);

  // ── Computed: top projects (grouped by name, active only) ──────────────────
  const topProjectsData = useMemo(() => {
    const map: Record<string, any> = {};
    projectList.filter(p => !p.is_deleted && p.project_name).forEach(p => {
      const key = (p.project_name || '').trim().toLowerCase();
      if (!map[key]) map[key] = { name: p.project_name, count: 0, types: {} as Record<string,number>, users: new Set<string>(), latestDate: p.created_at };
      map[key].count++;
      const tk = p.project_type_id || '__none__';
      map[key].types[tk] = (map[key].types[tk] || 0) + 1;
      if (p.user_name) map[key].users.add(p.user_name);
      if ((p.created_at || '') > (map[key].latestDate || '')) map[key].latestDate = p.created_at;
    });
    return Object.values(map).map((v: any) => ({
      name: v.name,
      count: v.count,
      users: Array.from(v.users as Set<string>),
      topTypeId: (Object.entries(v.types) as [string,number][]).sort((a,b) => b[1]-a[1])[0]?.[0] ?? null,
      latestDate: v.latestDate,
    })).sort((a,b) => b.count - a.count);
  }, [projectList]);

  // ── Computed: no-user projects (active only) ───────────────────────────────
  const noUserProjects = useMemo(() =>
    projectList.filter(p => !p.is_deleted && !p.user_id),
    [projectList]
  );

  // ── Computed: detail occurrences for selected project ─────────────────────
  const selectedOccurrences = useMemo(() => {
    if (!selectedProjectName) return [];
    const key = selectedProjectName.trim().toLowerCase();
    return projectList.filter(p => (p.project_name || '').trim().toLowerCase() === key);
  }, [selectedProjectName, projectList]);

  // ── Computed: displayed list for all/no_user tabs ─────────────────────────
  const displayList = useMemo(() => {
    const base = activeTab === 'no_user' ? noUserProjects : projectList;
    if (!searchProject) return base;
    const q = searchProject.toLowerCase();
    return base.filter(p =>
      (p.project_name || '').toLowerCase().includes(q) ||
      (p.company_name || '').toLowerCase().includes(q) ||
      (p.user_name    || '').toLowerCase().includes(q)
    );
  }, [activeTab, projectList, noUserProjects, searchProject]);

  // ── Loading splash ─────────────────────────────────────────────────────────
  if (loading && dashboardData.length === 0) return (
    <div className="p-20 text-center flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 border-8 border-slate-100 rounded-full" />
        <div className="absolute inset-0 border-8 border-indigo-600 rounded-full border-t-transparent animate-spin" />
      </div>
      <p className="mt-6 text-slate-400 font-bold animate-pulse tracking-widest">LOADING DATA...</p>
    </div>
  );

  const dimCls = loading ? 'opacity-50 pointer-events-none' : '';

  return (
    <>
    <div className="p-4 md:p-10 bg-[#FCFDFF] min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── HEADER + FILTER BAR ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 mb-2">
          <div>
            <div className="flex items-center gap-2 text-indigo-500 font-black text-[10px] uppercase tracking-[0.3em] mb-3">
              <Activity size={14} /> Intelligence System
            </div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tight">
              Business <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Summary</span>
            </h1>
          </div>

          {/* DashboardDateFilter — ใช้ URL params ทั้งหมด */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <DashboardDateFilter
              salesList={salesList}
              projectTypes={projectTypes}
              productCategories={productCategories}
              teams={teams}
              customerTypes={customerTypes} // 🌟 4. จ่าย Props ตัวที่ขาดไปให้เรียบร้อย บั๊กหายทันทีครับ!
            />
          </div>
        </div>

        {/* ── LEADERBOARD ──────────────────────────────────────────────────── */}
        <div className={`bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden transition-opacity duration-300 ${dimCls}`}>
          <div className="p-8 border-b border-slate-50 flex items-center gap-4">
            <div className="p-4 bg-slate-900 rounded-2xl text-white shadow-xl"><BarChart2 size={24} /></div>
            <div>
              <h2 className="font-black text-2xl text-slate-800">Leaderboard</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Overall Network Performance</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="bg-slate-50/30 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-50">
                  <th className="px-8 py-6 text-center">Rank</th>
                  <th className="px-6 py-6">Category</th>
                  <th className="px-6 py-6 text-center">Total Co.</th>
                  <th className="px-6 py-6 text-center text-emerald-600">Active</th>
                  <th className="px-6 py-6 text-center text-rose-500">Inactive</th>
                  <th className="px-8 py-6 text-center">Active %</th>
                  <th className="px-8 py-6 text-center">Inactive %</th>
                  <th className="px-8 py-6 text-center">Projects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dashboardData.map((cat, i) => (
                  <tr key={cat.id} className="hover:bg-slate-50/50 transition-all duration-300">
                    <td className="px-8 py-8 text-center">
                      {i === 0 ? <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shadow-md mx-auto text-white"><Trophy size={20} /></div> :
                       i === 1 ? <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center mx-auto text-slate-500"><Trophy size={18} /></div> :
                       i === 2 ? <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mx-auto text-orange-600"><Trophy size={18} /></div> :
                       <span className="text-slate-300 font-black text-lg">{i + 1}</span>}
                    </td>
                    <td className="px-6 py-8"><span className="font-black text-slate-700 text-lg">{cat.name}</span></td>
                    <td className="px-6 py-8 text-center font-bold text-slate-400">{cat.total}</td>
                    <td className="px-6 py-8 text-center font-black text-emerald-500">{cat.active}</td>
                    <td className="px-6 py-8 text-center font-black text-rose-400">{cat.inactive}</td>
                    <td className="px-8 py-8 border-l border-slate-50">
                      <div className="flex flex-col items-center gap-2">
                        <span className="font-black text-emerald-600 text-lg">{cat.activeRate ?? 0}%</span>
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${cat.activeRate ?? 0}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex flex-col items-center gap-2">
                        <span className={`font-black text-lg ${(cat.inactiveRate ?? 0) > 50 ? 'text-rose-600' : 'text-slate-400'}`}>{cat.inactiveRate ?? 0}%</span>
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-rose-400 rounded-full transition-all duration-1000" style={{ width: `${cat.inactiveRate ?? 0}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-8 text-right font-black text-indigo-600 text-2xl">{cat.projectCount ?? 0}</td>
                  </tr>
                ))}

                {totals && (
                  <tr className="bg-white border-t-4 border-indigo-600 relative z-10 shadow-[0_-15px_30px_rgba(99,102,241,0.08)]">
                    <td className="px-8 py-10 text-center">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border-2 border-indigo-100 shadow-inner"><Sigma size={24} /></div>
                    </td>
                    <td className="px-6 py-10">
                      <div className="flex flex-col">
                        <span className="text-2xl font-black tracking-tighter text-slate-900 uppercase">Grand Total</span>
                        <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Network Performance</span>
                      </div>
                    </td>
                    <td className="px-6 py-10 text-center text-2xl font-black text-slate-400">{totals.total}</td>
                    <td className="px-6 py-10 text-center"><div className="text-emerald-600 font-black text-2xl underline decoration-emerald-200 underline-offset-4">{totals.active}</div></td>
                    <td className="px-6 py-10 text-center"><div className="text-rose-500 font-black text-2xl underline decoration-rose-100 underline-offset-4">{totals.inactive}</div></td>
                    <td className="px-8 py-10 text-center bg-indigo-50/30">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-3xl font-black text-indigo-600">{totals.activeRate ?? 0}%</span>
                        <div className="w-24 h-2.5 bg-indigo-200/50 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${totals.activeRate ?? 0}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-10 text-center bg-rose-50/30">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-3xl font-black text-rose-500">{totals.inactiveRate ?? 0}%</span>
                        <div className="w-24 h-2.5 bg-rose-200/50 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-rose-500 rounded-full transition-all duration-1000" style={{ width: `${totals.inactiveRate ?? 0}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-10 text-right bg-indigo-600">
                      <div className="flex flex-col items-end">
                        <span className="text-5xl font-black text-white tracking-tighter">{totals.projectCount ?? 0}</span>
                        <span className="text-[11px] text-indigo-200 font-bold uppercase tracking-widest mt-1">Total Projects</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ALL PROJECTS TABLE ────────────────────────────────────────────── */}
        <div className={`bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden transition-opacity duration-300 ${dimCls}`}>
          {/* Header */}
          <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-emerald-600 rounded-2xl text-white shadow-xl"><Activity size={24} /></div>
              <div>
                <h2 className="font-black text-2xl text-slate-800">All Projects</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  ทั้งหมด {projectList.length} รายการ · Active {projectList.filter(p => !p.is_deleted).length} · Deleted {projectList.filter(p => p.is_deleted).length}
                </p>
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="ค้นหาชื่อโปรเจกต์ / บริษัท / ผู้รับผิดชอบ..."
                value={searchProject}
                onChange={e => setSearchProject(e.target.value)}
                className="pl-4 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 outline-none focus:border-emerald-400 w-[300px] transition-colors"
              />
              {searchProject && (
                <button onClick={() => setSearchProject('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">✕</button>
              )}
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex gap-2 px-8 pt-6 pb-2">
            {([
              { key: 'all',     label: 'ทั้งหมด',              count: projectList.length,      color: 'emerald' },
              { key: 'top',     label: '🏆 Top ใช้มากสุด',     count: topProjectsData.length,  color: 'indigo'  },
              { key: 'no_user', label: '⚠️ ไม่มีผู้รับผิดชอบ', count: noUserProjects.length,    color: 'rose'    },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-200 border ${
                  activeTab === tab.key
                    ? tab.color === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                    : tab.color === 'indigo'  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-rose-500 text-white border-rose-500 shadow-md'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                {tab.label}
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-black ${activeTab === tab.key ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* ── TOP tab: aggregated view ── */}
          {activeTab === 'top' && (
            <div className="overflow-x-auto p-4">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="bg-slate-50/30 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-50">
                    <th className="px-6 py-5 text-center">Rank</th>
                    <th className="px-6 py-5">ชื่อโปรเจกต์</th>
                    <th className="px-6 py-5 text-center">จำนวนครั้งที่ใช้</th>
                    <th className="px-6 py-5">เทมเพลตที่ใช้มากสุด</th>
                    <th className="px-6 py-5">ผู้รับผิดชอบ</th>
                    <th className="px-6 py-5 text-right">ล่าสุด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {topProjectsData
                    .filter(p => !searchProject || p.name.toLowerCase().includes(searchProject.toLowerCase()))
                    .map((p, idx) => (
                    <tr key={idx} onClick={() => setSelectedProjectName(p.name)} className="hover:bg-indigo-50/40 transition-all duration-200 cursor-pointer group">
                      <td className="px-6 py-5 text-center">
                        {idx === 0 ? <div className="w-9 h-9 bg-yellow-400 rounded-xl flex items-center justify-center shadow mx-auto text-white"><Trophy size={16} /></div>
                        : idx === 1 ? <div className="w-9 h-9 bg-slate-200 rounded-xl flex items-center justify-center mx-auto text-slate-500"><Trophy size={14} /></div>
                        : idx === 2 ? <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center mx-auto text-orange-500"><Trophy size={14} /></div>
                        : <span className="text-slate-300 font-black">{idx + 1}</span>}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">{p.name}</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-indigo-400 font-black uppercase tracking-wider">ดูรายละเอียด →</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-black text-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          {p.count} ครั้ง
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        {p.topTypeId && p.topTypeId !== '__none__'
                          ? <span className="px-2.5 py-1 bg-violet-50 text-violet-600 rounded-lg text-[11px] font-black">{typeMap[p.topTypeId] || p.topTypeId}</span>
                          : <span className="text-slate-200 text-sm">—</span>}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-1">
                          {(p.users as string[]).slice(0, 3).map((u: string) => (
                            <span key={u} className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[11px] font-semibold">
                              <span className="w-4 h-4 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-[9px] font-black flex-shrink-0">{u.charAt(0).toUpperCase()}</span>
                              {u}
                            </span>
                          ))}
                          {(p.users as string[]).length > 3 && (
                            <span className="text-[11px] text-slate-400 font-bold">+{(p.users as string[]).length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right text-xs font-bold text-slate-400">
                        {p.latestDate ? new Date(p.latestDate).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                  {topProjectsData.length === 0 && (
                    <tr><td colSpan={6} className="px-8 py-16 text-center text-slate-300 font-black text-sm">ไม่พบข้อมูล</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── ALL / NO_USER tab: standard table ── */}
          {activeTab !== 'top' && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="bg-slate-50/30 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-50">
                    <th className="px-6 py-5 text-center w-10">#</th>
                    <th className="px-6 py-5 text-center">สถานะ</th>
                    <th className="px-6 py-5">ชื่อโปรเจกต์</th>
                    <th className="px-6 py-5 text-center">พื้นที่ (ตร.ม.)</th>
                    <th className="px-6 py-5">บริษัท</th>
                    <th className="px-6 py-5">ประเภท</th>
                    <th className="px-6 py-5">ผู้รับผิดชอบ</th>
                    <th className="px-6 py-5 text-right">วันที่สร้าง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayList.map((p, idx) => (
                    <tr key={p.id} className={`hover:bg-slate-50/50 transition-all duration-200 ${p.is_deleted ? 'opacity-40' : ''}`}>
                      <td className="px-6 py-5 text-center text-slate-300 font-black text-sm">{idx + 1}</td>
                      <td className="px-6 py-5 text-center">
                        {p.is_deleted ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-500 text-[11px] font-black uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />Deleted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-black uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          {p.is_important && <span className="text-amber-400 text-base leading-none">★</span>}
                          <span className={`font-bold ${p.project_name ? 'text-slate-700' : 'text-slate-300 italic'}`}>
                            {p.project_name || '— ไม่ระบุชื่อ —'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center font-bold text-slate-500 text-sm">
                        {p.area_sqm > 0 ? p.area_sqm.toLocaleString() : <span className="text-slate-200">—</span>}
                      </td>
                      <td className="px-6 py-5">
                        <span className={`text-sm font-semibold ${p.company_name ? 'text-slate-600' : 'text-slate-200 italic'}`}>
                          {p.company_name || '— ไม่ระบุ —'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        {p.cat_name
                          ? <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[11px] font-black uppercase tracking-wider">{p.cat_name}</span>
                          : <span className="text-slate-200 text-sm italic">—</span>}
                      </td>
                      <td className="px-6 py-5">
                        {p.user_name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[11px] font-black flex-shrink-0">
                              {p.user_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-slate-600">{p.user_name}</span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 bg-rose-50 text-rose-400 rounded-lg text-[11px] font-black">ไม่มีผู้รับผิดชอบ</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-xs font-bold text-slate-400">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {displayList.length === 0 && !loading && (
                    <tr>
                      <td colSpan={8} className="px-8 py-20 text-center text-slate-300 font-black uppercase tracking-widest text-sm">
                        {activeTab === 'no_user' ? 'ไม่พบโปรเจกต์ที่ไม่มีผู้รับผิดชอบ 🎉' : 'ไม่พบข้อมูลโปรเจกต์'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── CHARTS ───────────────────────────────────────────────────────── */}
        {/* 🛠️ เติมความสูง h-[320px] คุมกล่องนอกสุดของกราฟทั้ง 2 ตัวตรงนี้ครับนาย */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 transition-opacity duration-300 ${dimCls}`}>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><PieChart size={20} /></div>
              <h3 className="font-black text-xl text-slate-800 tracking-tight">Project Distribution</h3>
            </div>
            <div className="h-[320px] w-full min-w-0"> {/* 👈 เติมความสูงตรงนี้เพื่อคุม ResponsiveContainer */}
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <RePie>
                  <Pie data={dashboardData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="projectCount">
                    {dashboardData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} itemStyle={{ fontWeight: 'bold' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }} />
                </RePie>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><BarChart2 size={20} /></div>
              <h3 className="font-black text-xl text-slate-800 tracking-tight">Company Engagement</h3>
            </div>
            <div className="h-[320px] w-full min-w-0"> {/* 👈 เติมความสูงตรงนี้เพื่อคุม ResponsiveContainer */}
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={dashboardData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                  <YAxis fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }} />
                  <Bar dataKey="active"   name="Active Co."   fill="#10b981" radius={[4,4,0,0]} maxBarSize={40} />
                  <Bar dataKey="inactive" name="Inactive Co." fill="#f43f5e" radius={[4,4,0,0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center pb-10">
          <span className="px-6 py-3 bg-white border border-slate-100 rounded-full text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] shadow-sm">
            Verified Data Analysis Engine · Filter Supported
          </span>
        </div>

      </div>
    </div>

    {/* ── PROJECT DETAIL SLIDE PANEL ─────────────────────────────────────── */}
    {selectedProjectName && (
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => { setSelectedProjectName(null); setShowOrderLinks(false); }} />

        {/* Panel */}
        <div className="w-full max-w-xl bg-[#F8FAFF] h-full overflow-y-auto shadow-2xl flex flex-col">

          {/* Panel header */}
          <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10 shadow-sm">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">รายละเอียดโปรเจกต์</div>
              <h2 className="text-lg font-black text-slate-900 leading-tight">{selectedProjectName}</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1.5 text-xs font-black">
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full">{selectedOccurrences.filter(o => !o.is_deleted).length} Active</span>
                {selectedOccurrences.filter(o => o.is_deleted).length > 0 &&
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-500 rounded-full">{selectedOccurrences.filter(o => o.is_deleted).length} Deleted</span>}
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowOrderLinks(v => !v)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black transition-colors whitespace-nowrap"
                >
                  🔗 เปิด Order ({[...new Set(selectedOccurrences.map((o: any) => o.order_id).filter(Boolean))].length})
                </button>
                {showOrderLinks && (
                  <div className="absolute right-0 top-9 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 p-3 min-w-[260px] space-y-1.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 pb-1 border-b border-slate-100">
                      **คลิกเพื่อเปิดแต่ละ Order ใน tab ใหม่**
                    </div>
                    {[...new Set(selectedOccurrences.map((o: any) => o.order_id).filter(Boolean))].map((id: any, i: number) => {
                      const occ = selectedOccurrences.find((o: any) => o.order_id === id);
                      return (
                        <a
                          key={id}
                          href={`/orders/${id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors group"
                        >
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-slate-700 group-hover:text-indigo-700 truncate">
                              {occ?.customer_name || occ?.company_name || 'Order'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{id.slice(0, 8)}...</div>
                          </div>
                          <span className="text-indigo-400 text-xs font-black opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
              <button onClick={() => { setSelectedProjectName(null); setShowOrderLinks(false); }} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-black transition-colors flex-shrink-0">✕</button>
            </div>
          </div>

          {/* Occurrences list */}
          <div className="p-5 space-y-5 flex-1">
            {selectedOccurrences.map((occ, idx) => (
              <div key={occ.id} className={`rounded-2xl overflow-hidden shadow-sm border transition-all ${occ.is_deleted ? 'opacity-50 border-rose-100' : 'border-slate-200 bg-white'}`}>

                {/* Card header — order info */}
                <div className="bg-white px-5 pt-5 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-300">#{idx + 1}</span>
                      {occ.is_deleted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-500 text-[10px] font-black uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />Deleted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-black uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />Active
                        </span>
                      )}
                      {occ.is_important && <span className="text-amber-400">★</span>}
                    </div>
                    <a
                      href={`/orders/${occ.order_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[11px] font-black text-indigo-500 hover:text-indigo-700 transition-colors bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg"
                    >
                      ดูออเดอร์ →
                    </a>
                  </div>

                  {/* Order detail rows */}
                  <div className="space-y-2.5">
                    {[
                      { label: 'Customer',   value: occ.customer_name },
                      { label: 'Company',    value: occ.company_name },
                      { label: 'Phone / Line', value: occ.phone },
                      { label: 'Sale Name',  value: occ.user_name },
                      { label: 'Date',       value: occ.created_at ? new Date(occ.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null },
                      { label: 'Source',     value: occ.source },
                      { label: 'หมวดหมู่',  value: occ.cat_name },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-baseline gap-3">
                        <span className="text-slate-400 text-sm w-28 flex-shrink-0">{label}</span>
                        <span className={`text-sm font-bold ${value ? 'text-slate-800' : 'text-slate-300'}`}>
                          {value || '–'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Note */}
                  {occ.note && (
                    <div className="mt-4 p-3.5 bg-indigo-50 rounded-xl border border-indigo-100">
                      <div className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-1">Note</div>
                      <p className="text-sm text-slate-700 leading-relaxed">{occ.note}</p>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100" />

                {/* Project (order_item_projects) section */}
                <div className="bg-slate-50/60 px-5 py-4">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">รายการโครงการ</div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {occ.product_category_id && productCatMap[occ.product_category_id] && (
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-black">{productCatMap[occ.product_category_id]}</span>
                    )}
                    {occ.project_type_id && typeMap[occ.project_type_id] && (
                      <span className="px-3 py-1 bg-violet-100 text-violet-600 rounded-full text-xs font-black">{typeMap[occ.project_type_id]}</span>
                    )}
                    <span className="px-3 py-1 bg-slate-200 text-slate-600 rounded-full text-xs font-black">
                      {occ.area_sqm > 0 ? `${occ.area_sqm.toLocaleString()} ตร.ม.` : '0 ตร.ม.'}
                    </span>
                    {occ.interest_level && (
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-black">{occ.interest_level}</span>
                    )}
                  </div>

                  {/* Stakeholders */}
                  <div className="space-y-2.5">
                    {[
                      { label: 'Developer',    account: occ.account_developer,    contact: occ.contact_developer },
                      { label: 'Architecture', account: occ.account_architecture, contact: occ.contact_architecture },
                      { label: 'Interior',     account: occ.account_interior,     contact: occ.contact_interior },
                      { label: 'Contractor',   account: occ.account_contractor,   contact: occ.contact_contractor },
                    ].map(({ label, account, contact }) => (
                      <div key={label} className="flex items-baseline gap-3">
                        <span className="text-slate-400 text-sm w-28 flex-shrink-0">{label}</span>
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${account ? 'text-slate-800' : 'text-slate-300'}`}>{account || '–'}</span>
                          {contact && <span className="text-xs text-slate-400">{contact}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ── Page export: wraps with Suspense (required for useSearchParams) ────────────
export default function ProjectReportsPage() {
  return (
    <Suspense fallback = {
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-8 border-slate-100 rounded-full" />
          <div className="absolute inset-0 border-8 border-indigo-600 rounded-full border-t-transparent animate-spin" />
        </div>
      </div>
    }>
      <ProjectReportsContent />
    </Suspense>
  );
}