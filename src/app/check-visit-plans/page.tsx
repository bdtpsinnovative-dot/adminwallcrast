'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Filter,
  FolderKanban,
  RefreshCw,
  RotateCcw,
  Search,
  Square,
  Trash2,
  UserRound,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type VisitPlan = {
  id: string;
  planned_date: string | null;
  start_time: string | null;
  end_time: string | null;
  project_concept: string | null;
  status: string | null;
  is_deleted: boolean | null;
  companies?: { name?: string | null } | null;
  projects?: { project_name?: string | null } | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

const isDeleted = (plan: VisitPlan) => plan.is_deleted === true;

const relationName = (value: VisitPlan['companies'] | VisitPlan['projects'] | VisitPlan['profiles']) => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const formatDate = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatTime = (value: string | null) => value ? value.slice(0, 5) : '--:--';

const isOverdue = (plan: VisitPlan, now: number) => {
  if (plan.status !== 'pending' || !plan.planned_date) return false;
  const endTime = plan.end_time?.slice(0, 5) || '23:59';
  const deadline = new Date(`${plan.planned_date}T${endTime}:00`);
  return !Number.isNaN(deadline.getTime()) && deadline.getTime() < now;
};

export default function CheckVisitPlansPage() {
  const [plans, setPlans] = useState<VisitPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DELETED'>('ACTIVE');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const fetchPlans = async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('visit_plans')
      .select(`
        id, planned_date, start_time, end_time, project_concept, status, is_deleted,
        companies (name),
        projects (project_name),
        profiles (full_name, email)
      `)
      .order('planned_date', { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setPlans([]);
    } else {
      setPlans((data || []) as VisitPlan[]);
    }
    setSelectedIds([]);
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPlans();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const ownerOptions = useMemo(() => {
    const owners = new Map<string, string>();
    plans.forEach((plan) => {
      const profile = relationName(plan.profiles);
      if (profile?.full_name) owners.set(profile.full_name, profile.full_name);
    });
    return Array.from(owners.values()).sort((a, b) => a.localeCompare(b, 'th'));
  }, [plans]);

  const filteredPlans = useMemo(() => {
    const term = search.trim().toLowerCase();
    return plans.filter((plan) => {
      const company = relationName(plan.companies)?.name || '';
      const project = relationName(plan.projects)?.project_name || '';
      const owner = relationName(plan.profiles)?.full_name || '';
      const plannedDate = plan.planned_date ? new Date(plan.planned_date).getTime() : 0;
      const fromTime = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
      const toTime = endDate ? new Date(`${endDate}T23:59:59`).getTime() : null;
      const matchesStatus = statusFilter === 'ALL'
        || (statusFilter === 'DELETED' && isDeleted(plan))
        || (statusFilter === 'ACTIVE' && !isDeleted(plan));
      const matchesOwner = ownerFilter === 'ALL' || owner === ownerFilter;
      const matchesStartDate = fromTime === null || plannedDate >= fromTime;
      const matchesEndDate = toTime === null || plannedDate <= toTime;
      const matchesSearch = !term || [company, project, owner, plan.project_concept || '']
        .join(' ')
        .toLowerCase()
        .includes(term);
      return matchesStatus && matchesOwner && matchesStartDate && matchesEndDate && matchesSearch;
    });
  }, [plans, search, statusFilter, ownerFilter, startDate, endDate]);

  const selectedVisible = filteredPlans.filter((plan) => selectedIds.includes(plan.id));
  const allVisibleSelected = filteredPlans.length > 0 && selectedVisible.length === filteredPlans.length;

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !filteredPlans.some((plan) => plan.id === id)));
    } else {
      setSelectedIds((current) => Array.from(new Set([...current, ...filteredPlans.map((plan) => plan.id)])));
    }
  };

  const updateTrashState = async (isDeletedValue: boolean) => {
    if (selectedIds.length === 0) return;
    const action = isDeletedValue ? 'ย้ายลงถังขยะ' : 'กู้คืน';
    if (!window.confirm(`${action} ${selectedIds.length} แผนงานใช่หรือไม่?`)) return;

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');

      const response = await fetch('/api/visit-plans/trash', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, is_deleted: isDeletedValue }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `${action}ไม่สำเร็จ`);

      await fetchPlans();
    } catch (error: any) {
      window.alert(`${action}ไม่สำเร็จ: ${error?.message || 'กรุณาลองใหม่อีกครั้ง'}`);
    } finally {
      setSaving(false);
    }
  };

  const permanentlyDelete = async () => {
    if (selectedIds.length === 0) return;
    const deletedCount = selectedVisible.filter(isDeleted).length;
    if (deletedCount !== selectedIds.length) {
      window.alert('กรุณาเลือกเฉพาะรายการในถังขยะก่อนลบถาวร');
      return;
    }
    if (!window.confirm(`ลบถาวร ${selectedIds.length} แผนงานใช่หรือไม่?\nข้อมูลจะกู้คืนไม่ได้`)) return;

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');

      const response = await fetch('/api/visit-plans/trash', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'ลบถาวรไม่สำเร็จ');

      await fetchPlans();
    } catch (error: any) {
      window.alert(`ลบถาวรไม่สำเร็จ: ${error?.message || 'กรุณาลองใหม่อีกครั้ง'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="fixed inset-0 z-0 flex flex-col overflow-hidden bg-slate-100 px-4 pb-5 pt-20 text-slate-900 sm:px-5">
      <section className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="z-20 flex-none border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-600 p-2 text-white"><ClipboardCheck size={20} /></div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">ตรวจสอบแผนงาน</h1>
                <p className="mt-1 text-xs text-slate-500">{filteredPlans.length} รายการ</p>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
              <div className="relative">
                <Search size={16} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input type="text" placeholder="ค้นหา..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-40 rounded-md border border-slate-300 py-1.5 pl-9 pr-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 lg:w-52" />
              </div>
              <div className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1">
                <CalendarDays size={14} className="text-slate-500" />
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-[120px] bg-transparent text-xs outline-none" />
                <span className="text-slate-400">-</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-[120px] bg-transparent text-xs outline-none" />
              </div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ALL">สถานะ: ทั้งหมด</option>
                <option value="ACTIVE">ปกติ</option>
                <option value="DELETED">ถังขยะ</option>
              </select>
              {selectedIds.length > 0 && (
                <div className="flex gap-1 rounded-lg border border-red-100 bg-red-50 p-1">
                  {selectedVisible.every(isDeleted) ? (
                    <button type="button" onClick={() => void updateTrashState(false)} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow disabled:opacity-50"><RotateCcw size={14} /> กู้คืน ({selectedIds.length})</button>
                  ) : (
                    <button type="button" onClick={() => void updateTrashState(true)} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1.5 text-xs font-medium text-white shadow disabled:opacity-50"><Trash2 size={14} /> ถังขยะ ({selectedIds.length})</button>
                  )}
                  {selectedVisible.length > 0 && selectedVisible.every(isDeleted) && <button type="button" onClick={() => void permanentlyDelete()} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-red-700 px-3 py-1.5 text-xs font-bold text-white shadow disabled:opacity-50"><AlertTriangle size={14} /> ลบถาวร</button>}
                </div>
              )}
              <button type="button" onClick={() => void fetchPlans()} disabled={loading || saving} className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50" title="รีเฟรชข้อมูล"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <Filter size={16} className="text-slate-400" />
            <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="min-w-[190px] rounded-md border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-800 outline-none focus:ring-2 focus:ring-blue-500">
              <option value="ALL">ผู้รับผิดชอบ: ทั้งหมด</option>
              {ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
            </select>
            <button type="button" onClick={toggleSelectAll} className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              {allVisibleSelected ? <CheckSquare size={15} /> : <Square size={15} />} เลือกทั้งหมด
            </button>
            {(search || ownerFilter !== 'ALL' || startDate || endDate || statusFilter !== 'ACTIVE') && <button type="button" onClick={() => { setSearch(''); setOwnerFilter('ALL'); setStartDate(''); setEndDate(''); setStatusFilter('ACTIVE'); setSelectedIds([]); }} className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">ล้างฟิลเตอร์</button>}
          </div>
        </div>

          {error && <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">โหลดข้อมูลไม่สำเร็จ: {error}</div>}
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-500"><RefreshCw size={18} className="animate-spin" /> กำลังโหลดแผนงาน...</div>
          ) : filteredPlans.length === 0 ? (
            <div className="p-16 text-center text-sm text-slate-400">ไม่พบแผนงานตามเงื่อนไข</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border border-slate-200 border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-12 border-b border-r border-slate-200 px-4 py-3"></th>
                    <th className="border-b border-r border-slate-200 px-4 py-3">วันที่ / เวลา</th>
                    <th className="border-b border-r border-slate-200 px-4 py-3">บริษัท</th>
                    <th className="border-b border-r border-slate-200 px-4 py-3">โครงการ</th>
                    <th className="border-b border-r border-slate-200 px-4 py-3">ผู้รับผิดชอบ</th>
                    <th className="border-b border-slate-200 px-4 py-3">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map((plan) => {
                    const company = relationName(plan.companies)?.name || 'ไม่ระบุบริษัท';
                    const project = relationName(plan.projects)?.project_name || 'ไม่ระบุโครงการ';
                    const owner = relationName(plan.profiles)?.full_name || 'ไม่ระบุ';
                    const deleted = isDeleted(plan);
      const overdue = isOverdue(plan, now);
                    return (
                      <tr key={plan.id} className={deleted ? 'bg-red-50/60 text-slate-400' : 'hover:bg-slate-50'}>
                        <td className="border-b border-r border-slate-200 px-4 py-3 align-top">
                          <button type="button" onClick={() => toggleSelected(plan.id)} className="text-blue-600">
                            {selectedIds.includes(plan.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </td>
                        <td className="whitespace-nowrap border-b border-r border-slate-200 px-4 py-3 align-top">
                          <div className="flex items-center gap-2 font-bold text-slate-700"><CalendarDays size={15} /> {formatDate(plan.planned_date)}</div>
                          <div className="mt-1 text-xs text-slate-400">{formatTime(plan.start_time)} - {formatTime(plan.end_time)} น.</div>
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3 align-top"><div className="flex items-center gap-2 font-bold text-slate-700"><UserRound size={15} /> {company}</div></td>
                        <td className="border-b border-r border-slate-200 px-4 py-3 align-top"><div className="flex items-center gap-2 text-slate-600"><FolderKanban size={15} /> {project}</div>{plan.project_concept && <p className="mt-1 max-w-xs truncate text-xs text-slate-400">{plan.project_concept}</p>}</td>
                        <td className="border-b border-r border-slate-200 px-4 py-3 align-top text-slate-600">{owner}</td>
                        <td className="border-b border-slate-200 px-4 py-3 align-top">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${deleted || overdue ? 'bg-red-100 text-red-700' : plan.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {deleted ? 'ถังขยะ' : overdue ? 'เลยกำหนด' : plan.status === 'completed' ? 'สำเร็จ' : 'รอดำเนินการ'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
    </main>
  );
}
