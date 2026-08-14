"use client";

import { useState, useEffect, useTransition, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, ShoppingCart, Clock, TrendingUp, 
  Calendar, Users, Map as MapIcon, Activity, AlertCircle, Star, Target, Database, MapPin, Building2, Scaling,
  ChevronRight, Smartphone, FileText, Loader2, Folder
} from 'lucide-react';
import Link from 'next/link';
import VipPipelineTable from '@/components/VipPipelineTable';
import DashboardCharts from '@/components/DashboardCharts';
import DashboardDateFilter from '@/components/DashboardDateFilter';
import CompanyCandlestickChart from '@/components/CompanyCandlestickChart';
import AiChatAssistant from '@/components/AiChatAssistant';
import WeeklyVisitPlanner from '@/components/WeeklyVisitPlanner';

interface Props {
  currentUserRole: string;
  currentUserTeamId: string | null;
  profiles: any[];
  projectTypes: any[];
  productCategories: any[];
  teams: any[];
  customerTypes: any[];
  variant?: 'standard' | 'advance';
}

interface CacheData {
  minFetched: string;
  maxFetched: string;
  projects: any[];
}

const mergeProjects = (existing: any[], incoming: any[]) => {
  const map = new Map<string, any>();
  existing.forEach(p => map.set(p.id, p));
  incoming.forEach(p => map.set(p.id, p));
  return Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

const mapFlatToProject = (row: any) => ({
  id: row.id,
  project_name: row.project_name,
  area_sqm: row.area_sqm,
  created_at: row.created_at,
  is_important: row.is_important,
  project_type_id: row.project_type_id,
  project_note: row.project_note,
  account_developer: row.account_developer,
  account_architecture: row.account_architecture,
  account_interior: row.account_interior,
  account_contractor: row.account_contractor,
  queue_level: row.queue_level,
  project_year: row.project_year,
  project_types: row.project_type_name ? { name: row.project_type_name } : null,
  order_items: {
    id: row.order_item_id,
    note: row.sales_note,
    interest_level: row.interest_level,
    product_category_id: row.product_category_id,
    product_categories: row.product_category_name ? { name: row.product_category_name } : null,
    orders: {
      id: row.order_id,
      customer_name: row.customer_name,
      phone: row.phone,
      user_id: row.user_id,
      team_id: row.team_id,
      is_synced: row.is_synced,
      audit_log: row.audit_log,
      source: row.source,
      customer_type_id: row.customer_type_id,
      companies: row.company_name ? { id: row.company_id, name: row.company_name } : null
    }
  }
});

const fetchProjectsForRange = async (startIso: string, endIso: string) => {
  const PAGE_SIZE = 1000;
  
  const { data: firstBatch, count: rawTotalCount, error: firstError } = await supabase
    .from('v_dashboard_projects')
    .select('*', { count: 'exact' })
    .or('is_deleted.eq.false,is_deleted.is.null')
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (firstError) throw firstError;
  
  let fetched: any[] = (firstBatch || []).map(mapFlatToProject);
  
  if (rawTotalCount && rawTotalCount > PAGE_SIZE) {
    const promises = [];
    for (let offset = PAGE_SIZE; offset < rawTotalCount; offset += PAGE_SIZE) {
      promises.push(
        supabase
          .from('v_dashboard_projects')
          .select('*')
          .or('is_deleted.eq.false,is_deleted.is.null')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)
      );
    }
    const results = await Promise.all(promises);
    results.forEach(({ data, error }) => {
      if (error) throw error;
      if (data) fetched = [...fetched, ...data.map(mapFlatToProject)];
    });
  }
  return fetched;
};

export default function DashboardClientContainer({
  currentUserRole,
  currentUserTeamId,
  profiles,
  projectTypes,
  productCategories,
  teams,
  customerTypes,
  variant = 'standard'
}: Props) {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [minFetched, setMinFetched] = useState<string | null>(null);
  const [maxFetched, setMaxFetched] = useState<string | null>(null);
  const [visibleRepeatedVisits, setVisibleRepeatedVisits] = useState(10);

  // Load from cache on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('dashboard_projects_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.projects)) {
          setProjects(parsed.projects);
          setMinFetched(parsed.minFetched);
          setMaxFetched(parsed.maxFetched);
        }
      }
    } catch (e) {
      console.error('Failed to load cache:', e);
    }
  }, []);

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach(p => { map[p.id] = p.full_name; });
    return map;
  }, [profiles]);

  const projectTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    projectTypes.forEach(pt => { map[pt.id] = pt.name; });
    return map;
  }, [projectTypes]);

  // Date ranges
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  ninetyDaysAgo.setHours(0, 0, 0, 0); 
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const startIso = startParam 
    ? new Date(`${startParam}T00:00:00+07:00`).toISOString() 
    : ninetyDaysAgo.toISOString();
    
  const endIso = endParam 
    ? new Date(`${endParam}T23:59:59.999+07:00`).toISOString() 
    : endOfToday.toISOString();

  // Load data incrementally
  useEffect(() => {
    let active = true;
    
    const load = async () => {
      setLoading(true);
      try {
        let currentProjects = projects;
        let currentMin = minFetched;
        let currentMax = maxFetched;
        
        const cached = sessionStorage.getItem('dashboard_projects_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          currentProjects = parsed.projects || [];
          currentMin = parsed.minFetched || null;
          currentMax = parsed.maxFetched || null;
        }

        let newMin = currentMin;
        let newMax = currentMax;
        let mergedProjects = [...currentProjects];

        // 1. Empty cache
        if (!currentMin || !currentMax || mergedProjects.length === 0) {
          const fetched = await fetchProjectsForRange(startIso, endIso);
          mergedProjects = fetched;
          newMin = startIso;
          newMax = endIso;
        } else {
          // 2. Fetch older range
          if (new Date(startIso) < new Date(currentMin)) {
            const olderStart = startIso;
            const olderEnd = new Date(new Date(currentMin).getTime() - 1).toISOString();
            const fetched = await fetchProjectsForRange(olderStart, olderEnd);
            mergedProjects = mergeProjects(mergedProjects, fetched);
            newMin = startIso;
          }
          
          // 3. Fetch newer range
          if (new Date(endIso) > new Date(currentMax)) {
            const newerStart = new Date(new Date(currentMax).getTime() + 1).toISOString();
            const newerEnd = endIso;
            const fetched = await fetchProjectsForRange(newerStart, newerEnd);
            mergedProjects = mergeProjects(mergedProjects, fetched);
            newMax = endIso;
          }
        }

        if (active) {
          setProjects(mergedProjects);
          setMinFetched(newMin);
          setMaxFetched(newMax);
          
          sessionStorage.setItem('dashboard_projects_cache', JSON.stringify({
            minFetched: newMin,
            maxFetched: newMax,
            projects: mergedProjects
          }));
        }
      } catch (err) {
        console.error('Error fetching dashboard projects:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    
    return () => {
      active = false;
    };
  }, [startIso, endIso]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const fetched = await fetchProjectsForRange(startIso, endIso);
      const merged = mergeProjects(projects, fetched);
      setProjects(merged);
      sessionStorage.setItem('dashboard_projects_cache', JSON.stringify({
        minFetched: minFetched || startIso,
        maxFetched: maxFetched || endIso,
        projects: merged
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Get active filters from URL parameters
  const filterTeam = currentUserRole === 'admin' ? (searchParams.get('team') || 'ALL') : currentUserTeamId;
  const filterSales = searchParams.get('sales') || 'ALL';
  const filterProjectType = searchParams.get('projectType') || 'ALL';
  const filterProductCategory = searchParams.get('productCategory') || 'ALL';
  const filterSource = searchParams.get('source') || 'ALL';
  const filterCustomerType = searchParams.get('customerType') || 'ALL'; 
  const minArea = searchParams.get('minArea') || '';
  const maxArea = searchParams.get('maxArea') || '';

  // 1. Filter raw projects based on the current date range
  const dateFilteredProjects = useMemo(() => {
    return projects.filter(p => {
      const date = new Date(p.created_at);
      return date >= new Date(startIso) && date <= new Date(endIso);
    });
  }, [projects, startIso, endIso]);

  // 2. Filter projects based on dropdown filter selections (excluding area size so we can count them for the area selection buttons)
  const filteredWithoutArea = useMemo(() => {
    return dateFilteredProjects.filter(p => {
      const orderItem = Array.isArray(p.order_items) ? p.order_items[0] : p.order_items;
      const order = orderItem?.orders;
      
      if (filterProjectType !== 'ALL' && p.project_type_id !== filterProjectType) return false;
      if (filterProductCategory !== 'ALL' && orderItem?.product_category_id !== filterProductCategory) return false;
      if (filterSales !== 'ALL' && order?.user_id !== filterSales) return false;
      if (filterTeam !== 'ALL' && order?.team_id !== filterTeam) return false;
      if (filterCustomerType !== 'ALL' && order?.customer_type_id !== filterCustomerType) return false;

      if (filterSource === 'APP') {
        if (!order?.audit_log) return false;
      } else if (filterSource === 'IMPORT') {
        if (order?.audit_log) return false;
      }

      return true;
    });
  }, [dateFilteredProjects, filterProjectType, filterProductCategory, filterSales, filterTeam, filterCustomerType, filterSource]);

  // 3. Compute area counts
  const areaCounts = useMemo(() => {
    const counts = { ZERO: 0, XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
    filteredWithoutArea.forEach(p => {
      const a = Number(p.area_sqm) || 0;
      if (a === 0) counts.ZERO++;
      else if (a <= 30) counts.XS++;
      else if (a <= 100) counts.S++;
      else if (a <= 300) counts.M++;
      else if (a <= 500) counts.L++;
      else if (a <= 1000) counts.XL++;
      else counts.XXL++;
    });
    return counts;
  }, [filteredWithoutArea]);

  // 4. Final filter including area size
  const allActiveProjects = useMemo(() => {
    return filteredWithoutArea.filter(p => {
      const a = Number(p.area_sqm) || 0;
      if (minArea && a < Number(minArea)) return false;
      if (maxArea && a > Number(maxArea)) return false;
      return true;
    });
  }, [filteredWithoutArea, minArea, maxArea]);

  // 5. Build rest of dashboard stats based on allActiveProjects
  const companyStats = useMemo(() => {
    const stats: Record<string, { id: string, name: string, count: number, salesBreakdown: Record<string, number>, uniqueProjects: Map<string, Date>, totalSqm: number }> = {};
    allActiveProjects.forEach(proj => {
      const orderItem = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
      const order = orderItem?.orders;
      const company = order?.companies;
      
      if (!order?.audit_log) return;

      const userId = order?.user_id || 'unknown';
      const salesName = profileMap[userId] || (userId === 'unknown' ? 'ไม่ระบุ/ไม่มีเซลส์' : 'พนักงานที่ถูกลบ');

      if (company && company.name && company.id) {
        const cName = company.name;
        if (!stats[cName]) stats[cName] = { id: company.id, name: cName, count: 0, salesBreakdown: {}, uniqueProjects: new Map(), totalSqm: 0 };
        
        stats[cName].count += 1; 
        stats[cName].totalSqm += (Number(proj.area_sqm) || 0);
        
        const projName = proj.project_name?.trim() || '';
        if (projName && projName !== 'ไม่มีการระบุโครงการ' && projName !== 'ไม่ระบุโครงการ') {
          const pDate = new Date(proj.created_at || order?.created_at || new Date());
          const existingDate = stats[cName].uniqueProjects.get(projName);
          if (!existingDate || pDate < existingDate) {
            stats[cName].uniqueProjects.set(projName, pDate);
          }
        }

        if (!stats[cName].salesBreakdown[salesName]) stats[cName].salesBreakdown[salesName] = 0;
        stats[cName].salesBreakdown[salesName] += 1;
      }
    });
    return stats;
  }, [allActiveProjects, profileMap]);

  const repeatedVisitsData = useMemo(() => {
    return Object.values(companyStats)
      .filter(comp => comp.count >= 3)
      .sort((a, b) => b.count - a.count);
  }, [companyStats]);

  const uniqueSalesNamesForChart = useMemo(() => {
    const set = new Set<string>();
    allActiveProjects.forEach(proj => {
      const orderItem = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
      const order = orderItem?.orders;
      if (!order?.audit_log) return;
      const userId = order?.user_id || 'unknown';
      const salesName = profileMap[userId] || (userId === 'unknown' ? 'ไม่ระบุ/ไม่มีเซลส์' : 'พนักงานที่ถูกลบ');
      set.add(salesName);
    });
    return set;
  }, [allActiveProjects, profileMap]);

  const candlestickData = useMemo(() => {
    return Object.values(companyStats)
      .map(comp => ({ id: comp.id, name: comp.name, count: comp.count, ...comp.salesBreakdown }))
      .sort((a, b) => b.count - a.count);
  }, [companyStats]);

  const chartSalesKeys = useMemo(() => Array.from(uniqueSalesNamesForChart), [uniqueSalesNamesForChart]);
  const activeProjectsCount = allActiveProjects.length; 
  const totalAreaSqm = useMemo(() => allActiveProjects.reduce((sum, proj) => sum + (Number(proj.area_sqm) || 0), 0), [allActiveProjects]);
  
  const thaiTime = useMemo(() => new Date(new Date().getTime() + (7 * 60 * 60 * 1000)), []);
  const currentMonth = thaiTime.getUTCMonth();
  const currentYear = thaiTime.getUTCFullYear();
  const currentDate = thaiTime.getUTCDate();

  const extraCalculatedStats = useMemo(() => {
    let monthOrders = 0;
    let todayOrders = 0;
    let importantProjectsCount = 0;
    const pendingSyncOrderIds = new Set();
    
    const salesPerformanceData: Record<string, { count: number, area: number, syncedCount: number, pendingCount: number }> = {};
    const dailyCountMap: Record<string, { date: string, count: number, timestamp: number }> = {};
    const projectTypeCountMap: Record<string, number> = {};

    let intVeryHigh = 0, intHigh = 0, intMedium = 0, intFollow = 0, intLow = 0, intNull = 0; 
    let devCount = 0, archCount = 0, intCount = 0, contCount = 0;

    allActiveProjects.forEach(proj => {
      const orderItem = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
      const order = orderItem?.orders;
      
      const userId = order?.user_id || 'unknown';
      const area = Number(proj.area_sqm) || 0;
      const isSynced = order?.is_synced ?? true;
      
      if (proj.is_important) importantProjectsCount++;

      const pTypeId = proj.project_type_id;
      const typeName = pTypeId && projectTypeMap[pTypeId] ? projectTypeMap[pTypeId] : 'ไม่ระบุประเภท';
      
      if (typeName !== 'ไม่ระบุประเภท' && typeName !== 'ไม่ระบุ' && typeName !== 'Unspecified' && typeName !== 'Unknown' && typeName !== '') {
          if (!projectTypeCountMap[typeName]) projectTypeCountMap[typeName] = 0;
          projectTypeCountMap[typeName]++;
      }

      const interest = orderItem?.interest_level || '';
      if (interest.includes('สนใจมาก (มีโครงการ')) intVeryHigh++;
      else if (interest.includes('สนใจมาก')) intHigh++;
      else if (interest.includes('สนใจปานกลาง')) intMedium++;
      else if (interest.includes('ติดตามงาน')) intFollow++;
      else if (interest.includes('สนใจน้อย')) intLow++;
      else intNull++; 

      if (proj.account_developer) devCount++;
      if (proj.account_architecture) archCount++;
      if (proj.account_interior) intCount++;
      if (proj.account_contractor) contCount++;

      if (order && isSynced === false && order.id) pendingSyncOrderIds.add(order.id);

      if (!salesPerformanceData[userId]) {
        salesPerformanceData[userId] = { count: 0, area: 0, syncedCount: 0, pendingCount: 0 };
      }
      salesPerformanceData[userId].count += 1;
      salesPerformanceData[userId].area += area;
      if (isSynced) salesPerformanceData[userId].syncedCount += 1;
      else salesPerformanceData[userId].pendingCount += 1;

      if (proj.created_at) {
        const projDateUTC = new Date(proj.created_at);
        const projThai = new Date(projDateUTC.getTime() + (7 * 60 * 60 * 1000));
        
        if (projThai.getUTCFullYear() === currentYear && projThai.getUTCMonth() === currentMonth) {
          monthOrders++;
          if (projThai.getUTCDate() === currentDate) todayOrders++;
        }

        const day = projThai.getUTCDate().toString().padStart(2, '0');
        const month = (projThai.getUTCMonth() + 1).toString().padStart(2, '0');
        const dateKey = `${day}/${month}`;
        const sortTimestamp = new Date(projThai.getUTCFullYear(), projThai.getUTCMonth(), projThai.getUTCDate()).getTime();

        if (!dailyCountMap[dateKey]) dailyCountMap[dateKey] = { date: dateKey, count: 0, timestamp: sortTimestamp };
        dailyCountMap[dateKey].count++;
      }
    });

    const pendingSync = pendingSyncOrderIds.size;
    const lineChartData = Object.values(dailyCountMap).sort((a, b) => a.timestamp - b.timestamp).slice(-14).map(i => ({ date: i.date, count: i.count }));
    const totalSpecifiedProjectsCount = Object.values(projectTypeCountMap).reduce((sum, count) => sum + count, 0);
    const projDividerForTypes = totalSpecifiedProjectsCount > 0 ? totalSpecifiedProjectsCount : 1;

    const projectTypeChartData = Object.entries(projectTypeCountMap)
      .map(([name, count]) => ({
        name: `${name} (${Math.round((count / projDividerForTypes) * 100)}%)`,
        value: count
      }))
      .sort((a, b) => b.value - a.value);

    return {
      monthOrders,
      todayOrders,
      importantProjectsCount,
      pendingSync,
      lineChartData,
      projectTypeChartData,
      salesPerformanceData,
      intVeryHigh,
      intHigh,
      intMedium,
      intFollow,
      intLow,
      intNull,
      devCount,
      archCount,
      intCount,
      contCount
    };
  }, [allActiveProjects, projectTypeMap, currentYear, currentMonth, currentDate]);

  const projDivider = activeProjectsCount > 0 ? activeProjectsCount : 1;
  
  const interestData = useMemo(() => [
    { name: 'สนใจมาก (มีโครงการ)', value: extraCalculatedStats.intVeryHigh },
    { name: 'สนใจมาก (ยังไม่มี)', value: extraCalculatedStats.intHigh },
    { name: 'สนใจปานกลาง', value: extraCalculatedStats.intMedium },
    { name: 'ติดตามงาน', value: extraCalculatedStats.intFollow },
    { name: 'สนใจน้อย', value: extraCalculatedStats.intLow },
    { name: 'ไม่ระบุ / NULL', value: extraCalculatedStats.intNull }
  ], [extraCalculatedStats]);

  const stakeholderData = useMemo(() => [
    { name: `Developer (${Math.round((extraCalculatedStats.devCount / projDivider) * 100)}%)`, count: extraCalculatedStats.devCount },
    { name: `Architect (${Math.round((extraCalculatedStats.archCount / projDivider) * 100)}%)`, count: extraCalculatedStats.archCount },
    { name: `Interior (${Math.round((extraCalculatedStats.intCount / projDivider) * 100)}%)`, count: extraCalculatedStats.intCount },
    { name: `Contractor (${Math.round((extraCalculatedStats.contCount / projDivider) * 100)}%)`, count: extraCalculatedStats.contCount }
  ], [extraCalculatedStats, projDivider]);

  const individualStats = useMemo(() => {
    return Object.entries(extraCalculatedStats.salesPerformanceData)
      .map(([id, stats]) => ({
        id, name: profileMap[id] || (id === 'unknown' ? 'ไม่ระบุ/ไม่มีเซลส์' : 'พนักงานที่ถูกลบ'),
        projects: stats.count, area: stats.area, syncedCount: stats.syncedCount, pendingCount: stats.pendingCount,
        syncRate: stats.count > 0 ? (stats.syncedCount / stats.count) * 100 : 0
      }))
      .sort((a, b) => b.projects - a.projects);
  }, [extraCalculatedStats, profileMap]);

  const pieChartData = useMemo(() => individualStats.map(stat => ({ name: stat.name, value: stat.projects })), [individualStats]);
  const barChartData = individualStats; 

  const vipProjects = useMemo(() => allActiveProjects.filter(p => p.is_important), [allActiveProjects]);

  const dashboardSummary = useMemo(() => ({
    totalProjects: activeProjectsCount,
    totalArea: totalAreaSqm,
    vipCount: extraCalculatedStats.importantProjectsCount,
    pendingSyncCount: extraCalculatedStats.pendingSync,
    topSales: individualStats.slice(0, 3).map(s => ({ name: s.name, projects: s.projects, area: s.area })),
    vipList: vipProjects.map(v => v.project_name),
    interestStats: { hot: extraCalculatedStats.intVeryHigh + extraCalculatedStats.intHigh, warm: extraCalculatedStats.intMedium, cold: extraCalculatedStats.intLow + extraCalculatedStats.intFollow },
    totalStakeholders: extraCalculatedStats.devCount + extraCalculatedStats.archCount + extraCalculatedStats.intCount + extraCalculatedStats.contCount
  }), [activeProjectsCount, totalAreaSqm, extraCalculatedStats, individualStats, vipProjects]);

  const checkInStats = useMemo(() => {
    const stats: Record<string, { appCount: number, csvCount: number, totalArea: number, locations: string[] }> = {};
    allActiveProjects.forEach(proj => {
      const orderItem = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
      const order = orderItem?.orders;
      const userId = order?.user_id || 'unknown';
      const auditLog = order?.audit_log;
      const area = Number(proj.area_sqm) || 0;

      if (!stats[userId]) {
        stats[userId] = { appCount: 0, csvCount: 0, totalArea: 0, locations: [] };
      }

      stats[userId].totalArea += area;

      if (auditLog) {
        stats[userId].appCount += 1;
        if (proj.project_name) stats[userId].locations.push(proj.project_name);
      } else {
        stats[userId].csvCount += 1;
      }
    });
    return stats;
  }, [allActiveProjects]);

  const checkInList = useMemo(() => {
    return Object.entries(checkInStats).map(([uId, stats]) => {
      return {
        userId: uId,
        name: profileMap[uId] || (uId === 'unknown' ? 'ไม่ระบุ/ไม่มีเซลส์' : 'พนักงานที่ถูกลบ'),
        appCount: stats.appCount,
        csvCount: stats.csvCount,
        totalArea: stats.totalArea, 
        total: stats.appCount + stats.csvCount,
        sampleLocation: stats.locations.length > 0 ? stats.locations[0] : '-',
      };
    }).sort((a, b) => b.appCount - a.appCount);
  }, [checkInStats, profileMap]);

  const visibleTeams = useMemo(() => {
    return currentUserRole === 'admin' 
      ? (teams || []) 
      : (teams || []).filter(t => t.id === currentUserTeamId);
  }, [currentUserRole, teams, currentUserTeamId]);
      
  const visibleSales = useMemo(() => {
    return currentUserRole === 'admin'
      ? (profiles || [])
      : (profiles || []).filter(p => p.team_id === currentUserTeamId);
  }, [currentUserRole, profiles, currentUserTeamId]);

  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-slate-900/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 px-5 py-3 rounded-xl border border-slate-200 shadow-lg flex items-center gap-3">
            <Loader2 className="animate-spin text-indigo-600" size={20} />
            <span className="font-bold text-slate-700 text-sm">กำลังโหลดข้อมูล...</span>
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 w-full">
        <div className="flex-none">
          <div className="flex items-center gap-3 text-indigo-700 mb-1">
            <LayoutDashboard size={28} className="stroke-[2.5]" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              {variant === 'advance' ? 'Dashboard Advance' : 'Enterprise Overview'}
              <span className="text-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2.5 py-0.5 rounded-full shadow-sm align-middle">God Mode</span>
            </h1>
            <button 
              onClick={handleRefresh}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-sm flex items-center gap-1.5 ml-2 cursor-pointer"
            >
              <Clock size={14} /> รีเฟรชข้อมูล
            </button>
          </div>
          <p className="text-slate-500 text-sm flex items-center gap-1.5">
            <Activity size={14} /> วิเคราะห์ข้อมูลทุกมิติ ทะลวงฐานข้อมูลแบบเรียลไทม์
          </p>
        </div>
        
        <div className="w-full xl:w-auto pb-2 xl:pb-0">
          <DashboardDateFilter
            salesList={visibleSales}
            projectTypes={projectTypes || []}
            productCategories={productCategories || []}
            teams={visibleTeams}
            customerTypes={customerTypes || []}
            areaCounts={areaCounts}
          />
        </div>
      </div>

      {/* 🌟 ชุดปุ่ม SIZE ทั้ง 7 ปรับโฉมใหม่: ตัวเลขตรงกลาง และชื่อไซส์อยู่ล่างนำหน้าช่วง ตร.ม. 🌟 */}
      <div className="mb-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Scaling size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 tracking-tight">ขนาดโปรเจ็ก SQM</h3>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
          {[
            { id: 'ZERO', label: '0 sqm.', min: '0', max: '0', subtitle: 'ไม่มีพื้นที่' },
            { id: 'XS', label: 'XS', min: '1', max: '30', subtitle: 'ต่ำกว่า 30 sqm' },
            { id: 'S', label: 'S', min: '31', max: '100', subtitle: '31 - 100 sqm.' },
            { id: 'M', label: 'M', min: '101', max: '300', subtitle: '101 - 300 sqm.' },
            { id: 'L', label: 'L', min: '301', max: '500', subtitle: '301 - 500 sqm.' },
            { id: 'XL', label: 'XL', min: '501', max: '1000', subtitle: '501 - 1,000 sqm.' },
            { id: 'XXL', label: 'XXL', min: '1001', max: '', subtitle: 'มากกว่า 1,000 sqm.' },
          ].map((btn) => {
            const isActive = minArea === btn.min && maxArea === btn.max;
            const projectCount = areaCounts[btn.id as keyof typeof areaCounts] || 0;
            
            const q = new URLSearchParams();
            if (searchParams) {
              searchParams.forEach((v, k) => {
                if (v && typeof v === 'string') q.set(k, v);
              });
            }
            if (isActive) {
              q.delete('minArea');
              q.delete('maxArea');
            } else {
              if (btn.min) q.set('minArea', btn.min); else q.delete('minArea');
              if (btn.max) q.set('maxArea', btn.max); else q.delete('maxArea');
            }
            const href = `?${q.toString()}`;

            return (
              <Link
                key={btn.id}
                href={href}
                className={`flex flex-col items-center justify-center py-4 px-3 rounded-xl border transition-all duration-200 group relative overflow-hidden min-h-[105px] ${
                  isActive 
                    ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 border-indigo-600 text-white shadow-md shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2 ring-offset-white scale-[1.03] z-10' 
                    : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-white hover:border-indigo-500 hover:shadow-md hover:shadow-slate-100'
                }`}
              >
                {!isActive && (
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200" />
                )}

                {/* 🟢 ตรงกลาง: แสดงจำนวนโปรเจกต์รวมเป็นตัวเลขตัวใหญ่พรีเมียม */}
                <span className={`font-black text-3xl md:text-4xl tracking-tight mb-1.5 ${
                  isActive ? 'text-white' : 'text-slate-800 group-hover:text-indigo-600 transition-colors'
                }`}>
                  {projectCount}
                </span>

                {/* 🟢 ด้านล่าง: เอาอักษรย่อไซส์มาตั้งนำหน้าช่วงพื้นที่ ตร.ม. */}
                <span className={`text-[11px] font-bold text-center leading-normal ${
                  isActive ? 'text-indigo-100' : 'text-slate-400 group-hover:text-slate-500 transition-colors'
                }`}>
                  {btn.id === 'ZERO' ? btn.label : `${btn.label} (${btn.subtitle})`}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {variant === 'advance' ? (
        <>
          <WeeklyVisitPlanner 
            projectTypes={projectTypes} 
            productCategories={productCategories} 
            currentUserRole={currentUserRole}
          />
          
          <div className="bg-white rounded-none border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-8 w-full">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 gap-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                <Users className="text-indigo-600" /> ผลการเข้าพบซ้ำ (ความถี่ 3 เช็คอินขึ้นไป)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap text-sm border-collapse border border-slate-200">
                <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-3 border border-slate-200 text-center w-16">Type</th>
                    <th className="px-5 py-3 border border-slate-200">Company Name</th>
                    <th className="px-5 py-3 border border-slate-200 text-center">ความถี่ (เช็คอิน)</th>
                    <th className="px-5 py-3 border border-slate-200 text-center">จำนวนโปรเจค</th>
                    <th className="px-5 py-3 border border-slate-200 text-left">รายชื่อโปรเจค</th>
                    <th className="px-5 py-3 border border-slate-200 text-right">SQM รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {repeatedVisitsData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400 italic border border-slate-200">ไม่มีบริษัทที่เข้าพบ 3 ครั้งขึ้นไปในช่วงเวลานี้</td>
                    </tr>
                  ) : (
                    repeatedVisitsData.slice(0, visibleRepeatedVisits).map((comp, index) => (
                      <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 text-center text-slate-500 border border-slate-200">
                          {index + 1}
                        </td>
                        <td className="px-5 py-3 font-medium text-slate-700 border border-slate-200">{comp.name}</td>
                        <td className="px-5 py-3 text-center text-slate-700 border border-slate-200">
                          {comp.count}
                        </td>
                        <td className="px-5 py-3 text-center border border-slate-200 align-top">
                          <span className="font-bold text-slate-800 text-sm">
                            {comp.uniqueProjects.size}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-left border border-slate-200 align-top">
                          {comp.uniqueProjects.size > 0 ? (
                            <div className="flex flex-col gap-1">
                              {Array.from(comp.uniqueProjects.entries()).map(([projName, dateVal], i) => (
                                <div key={i} className="flex items-start gap-1.5 mb-1.5 last:mb-0">
                                  <Folder size={13} className="text-indigo-500 mt-[2px] shrink-0" />
                                  <span className="text-[13px] text-slate-600 whitespace-normal break-words leading-tight flex-1">
                                    {projName} <span className="text-slate-400 text-[11px] whitespace-nowrap ml-1">({new Date(dateVal).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })})</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-emerald-600 border border-slate-200">
                          {comp.totalSqm.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {repeatedVisitsData.length > visibleRepeatedVisits && (
                <div className="p-4 flex justify-center bg-white border-t border-slate-100">
                  <button 
                    onClick={() => setVisibleRepeatedVisits(prev => prev + 10)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors shadow-sm"
                  >
                    โหลดเพิ่มเติม (Load More)
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* กล่องตัวเลข 4 กล่อง (ของเดิม) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">PROJETCS ทั้งหมด</p>
              <h2 className="text-3xl font-extrabold text-slate-800">{activeProjectsCount.toLocaleString()}</h2>
            </div>
            <div className="bg-blue-100 p-2.5 rounded-lg text-blue-600"><ShoppingCart size={22} /></div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <TrendingUp size={14} /> 
            <span>+{extraCalculatedStats.todayOrders} โปรเจกต์ใหม่วันนี้</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">โปรเจกต์สำคัญ (VIP)</p>
              <h2 className="text-3xl font-extrabold text-rose-600">{extraCalculatedStats.importantProjectsCount.toLocaleString()}</h2>
            </div>
            <div className="bg-rose-100 p-2.5 rounded-lg text-rose-600"><Star size={22} className="fill-rose-600" /></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">พื้นที่ดำเนินการ (ตร.ม.)</p>
              <h2 className="text-3xl font-extrabold text-slate-800">{totalAreaSqm.toLocaleString()}</h2>
            </div>
            <div className="bg-purple-100 p-2.5 rounded-lg text-purple-600"><MapIcon size={22} /></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">รออัปเดต / ขาดเชื่อมต่อ</p>
              <h2 className="text-3xl font-extrabold text-orange-600">{extraCalculatedStats.pendingSync.toLocaleString()}</h2>
            </div>
            <div className="bg-orange-100 p-2.5 rounded-lg text-orange-600"><AlertCircle size={22} /></div>
          </div>
        </div>
      </div>

      <DashboardCharts 
        lineData={extraCalculatedStats.lineChartData} 
        pieData={pieChartData} 
        barData={barChartData}
        projectTypeData={extraCalculatedStats.projectTypeChartData} 
        interestData={interestData} 
        stakeholderData={stakeholderData}
      />

      <CompanyCandlestickChart data={candlestickData} salesKeys={chartSalesKeys} />

      <div className="grid grid-cols-1 mb-8">
        <VipPipelineTable 
          projects={allActiveProjects} 
          profilesMap={profileMap} 
          salesStats={individualStats} 
          customerTypes={customerTypes || []}
          projectTypes={projectTypes || []} 
          productCategories={productCategories || []} 
          onRefresh={handleRefresh}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col mb-8">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <MapPin size={18} className="text-slate-600" /> สถิติการลงพื้นที่สร้างโปรเจกต์ (Check-ins & Data Import)
          </h3>
        </div>
        <div className="overflow-x-auto p-0">
          <table className="w-full text-left whitespace-nowrap text-sm">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-5 py-3 border-b border-slate-200">รายชื่อพนักงานขาย</th>
                <th className="px-5 py-3 border-b border-slate-200 text-center">ลงพื้นที่ (App)</th>
                <th className="px-5 py-3 border-b border-slate-200 text-center">อัปโหลดไฟล์ (CSV)</th>
                <th className="px-5 py-3 border-b border-slate-200">ตัวอย่างสถานที่ล่าสุด</th>
                <th className="px-5 py-3 border-b border-slate-200 text-right">พื้นที่รวม (ตร.ม.)</th>
                <th className="px-5 py-3 border-b border-slate-200 text-center">ดูข้อมูล</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {checkInList.map((ci, idx) => (
                <tr key={ci.userId || idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-semibold text-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shadow-sm">
                      {ci.name !== 'ไม่ระบุ/ไม่มีเซลส์' && ci.name !== 'พนักงานที่ถูกลบ' ? ci.name.charAt(0) : '?'}
                    </div>
                    {ci.name}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                      <Smartphone size={14} /> {ci.appCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                      <FileText size={14} /> {ci.csvCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    <span className="truncate max-w-[250px] inline-block align-bottom" title={ci.sampleLocation}>
                      {ci.sampleLocation}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-black text-base text-slate-700">
                    {ci.totalArea.toLocaleString()} <span className="text-xs font-bold text-slate-400 ml-0.5">ตร.ม.</span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <Link 
                      href={`/dashboard/checkins/${ci.userId}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100 shadow-sm"
                    >
                      ดูประวัติ <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <AiChatAssistant dashboardData={dashboardSummary} />
        </>
      )}
    </main>
  );
}
