"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, CheckCircle2, XCircle, Plus, ChevronLeft, ChevronRight, 
  Clock, Building2, User, Loader2, X, Filter
} from 'lucide-react';

interface Props {
  projectTypes: any[];
  productCategories: any[];
  customerTypes?: any[];
  currentUserRole: string;
  profiles?: any[];
  filterSales?: string;
}

type VisitPlanTiming = {
  status?: string | null;
  is_deleted?: boolean | null;
  planned_date?: string | null;
  end_time?: string | null;
};

const isPlanOverdue = (plan: VisitPlanTiming) => {
  if (plan?.status !== 'pending' || plan?.is_deleted === true || !plan?.planned_date) return false;
  const date = String(plan.planned_date).split('T')[0];
  const endTime = plan.end_time ? String(plan.end_time).slice(0, 5) : '23:59';
  const deadline = new Date(`${date}T${endTime}:00`);
  return !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();
};

const planDisplayStatus = (plan: VisitPlanTiming) => isPlanOverdue(plan) ? 'overdue' : plan?.status;

export default function WeeklyVisitPlanner({ 
  projectTypes, 
  productCategories, 
  customerTypes = [],
  currentUserRole, 
  profiles = [],
  filterSales = 'ALL'
}: Props) {
  const [weeks, setWeeks] = useState<{ start: Date, end: Date, label: string }[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
  const [isWeekPickerOpen, setIsWeekPickerOpen] = useState(false);
  const [dateViewMode, setDateViewMode] = useState<'week' | 'range'>('week');
  const [pickerMode, setPickerMode] = useState<'week' | 'range'>('week');
  const [selectedDateRange, setSelectedDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [draftRangeStart, setDraftRangeStart] = useState<Date | null>(null);
  const [draftRangeEnd, setDraftRangeEnd] = useState<Date | null>(null);
  const [pickerMonth, setPickerMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [companies, setCompanies] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Modal Form State
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStartTime, setSelectedStartTime] = useState('09:00');
  const [selectedEndTime, setSelectedEndTime] = useState('10:00');
  const [selectedAssignToUserId, setSelectedAssignToUserId] = useState('');
  const [isAssignDropdownOpen, setIsAssignDropdownOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [selectedProjectType, setSelectedProjectType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [concept, setConcept] = useState('');
  const [clientRequestId, setClientRequestId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [isReadOnlyPlan, setIsReadOnlyPlan] = useState(false);
  const [viewPlanDetail, setViewPlanDetail] = useState<any | null>(null);
  const [, setClock] = useState(() => Date.now());

  // Pipeline Data State (Algorithm)
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [companyProjectHistory, setCompanyProjectHistory] = useState<any[]>([]);
  const [salesOrderCounts, setSalesOrderCounts] = useState<Record<string, number>>({});
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);
  const [isLoadingProjectHistory, setIsLoadingProjectHistory] = useState(false);

  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCustomerTypeId, setNewCustomerTypeId] = useState('');
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isAddingProject, setIsAddingProject] = useState(false);

  const pipelineProjIds = useMemo(() => {
    const comp = pipelineData.find(p => p.company.id === selectedCompany);
    return new Set([
      ...companyProjectHistory.map(project => project.id),
      ...(comp ? comp.projects.map((project: any) => project.id) : []),
    ]);
  }, [selectedCompany, pipelineData, companyProjectHistory]);
  
  // Combobox State
  const [companySearch, setCompanySearch] = useState('');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [visibleCompanyCount, setVisibleCompanyCount] = useState(50);
  
  const [projectSearch, setProjectSearch] = useState('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [visibleProjectCount, setVisibleProjectCount] = useState(50);

  // Drag to scroll logic
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    isDragging.current = true;
    scrollContainerRef.current.classList.add('cursor-grabbing');
    scrollContainerRef.current.classList.remove('snap-x', 'snap-mandatory');
    startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeft.current = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.classList.remove('cursor-grabbing');
      scrollContainerRef.current.classList.add('snap-x', 'snap-mandatory');
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.classList.remove('cursor-grabbing');
      scrollContainerRef.current.classList.add('snap-x', 'snap-mandatory');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
  };
  
  // Helper: คำนวณวันจันทร์ของสัปดาห์นั้น
  const getMonday = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const toDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper: สร้างรายการสัปดาห์แบบ Dynamic ตามช่วงเวลาที่มีแผนงานจริง
  const generateWeeksFromPlans = (allPlans: any[], ensureTargetDate?: Date) => {
    const currentMonday = getMonday(new Date());
    let minMonday = new Date(currentMonday);
    let maxMonday = new Date(currentMonday);

    allPlans.forEach(p => {
      if (p.planned_date) {
        const pMonday = getMonday(new Date(p.planned_date));
        if (pMonday < minMonday) minMonday = pMonday;
        if (pMonday > maxMonday) maxMonday = pMonday;
      }
    });

    if (ensureTargetDate) {
      const targetMonday = getMonday(ensureTargetDate);
      if (targetMonday < minMonday) minMonday = targetMonday;
      if (targetMonday > maxMonday) maxMonday = targetMonday;
    }

    // ขยายขอบเขต ซ้าย -1 สัปดาห์ และ ขวา +1 สัปดาห์
    const startBound = new Date(minMonday);
    startBound.setDate(startBound.getDate() - 7);

    const endBound = new Date(maxMonday);
    endBound.setDate(endBound.getDate() + 7);

    const calculatedWeeks: { start: Date; end: Date; label: string }[] = [];
    for (let w = new Date(startBound); w <= endBound; w.setDate(w.getDate() + 7)) {
      const start = new Date(w);
      const end = new Date(w);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const label = `${start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`;
      calculatedWeeks.push({ start, end, label });
    }

    setWeeks(calculatedWeeks);
    const preferredWeek = ensureTargetDate
      ? getMonday(ensureTargetDate)
      : currentMonday;
    setSelectedWeekStart(current => {
      if (ensureTargetDate) return preferredWeek;
      if (current && calculatedWeeks.some(week => week.start.getTime() === current.getTime())) {
        return current;
      }
      return preferredWeek;
    });
  };

  const fetchPlans = async (targetWeekToFocus?: Date) => {
    setLoading(true);

    // ดึงแผนงานทั้งหมดมาคำนวณสัปดาห์แบบ Dynamic
    const { data, error } = await supabase
      .from('visit_plans')
      .select(`
        id, planned_date, start_time, end_time, client_request_id, project_concept, status, is_deleted, user_id, company_id, project_id, project_type_id, product_category_id,
        profiles (id, full_name, avatar_url, email),
        companies (id, name),
        projects (id, project_name),
        project_types (id, name),
        product_categories (id, name)
      `)
      .eq('is_deleted', false)
      .order('planned_date', { ascending: true });

    if (!error && data) {
      // 1. สร้างสัปดาห์แบบ Dynamic
      generateWeeksFromPlans(data, targetWeekToFocus);

      // 2. ตรวจสอบสถานะการเช็คอิน
      const { data: allOrders } = await supabase
        .from('orders')
        .select('company_id, user_id, created_at');

      const processedPlans = data.map((plan: any) => {
        if (plan.status === 'pending' && allOrders) {
          const planDate = new Date(plan.planned_date);
          const pMonday = getMonday(planDate);
          const pSunday = new Date(pMonday);
          pSunday.setDate(pSunday.getDate() + 6);
          pSunday.setHours(23, 59, 59, 999);

          const hasCheckIn = allOrders.some((o: any) => {
            const orderDate = new Date(o.created_at);
            return o.company_id === plan.company_id && o.user_id === plan.user_id && orderDate >= pMonday && orderDate <= pSunday;
          });

          if (hasCheckIn) {
            supabase.from('visit_plans').update({ status: 'completed' }).eq('id', plan.id).then();
            return { ...plan, status: 'completed' };
          }
        }
        return plan;
      });

      setPlans(processedPlans);
    }
    setLoading(false);
  };

  const fetchPipelineForUser = async (requestedUserId?: string) => {
    setIsLoadingPipeline(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('เซสชันหมดอายุ');

      const query = requestedUserId
        ? `?user_id=${encodeURIComponent(requestedUserId)}`
        : '';
      const response = await fetch(`/api/visit-planner-pipeline${query}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'โหลด Pipeline ไม่สำเร็จ');

      const pipeline = Array.isArray(result) ? result : result.pipeline || [];
      setPipelineData(
        pipeline
          .filter((item: any) => item?.company && item.is_mine === true)
          .sort((a: any, b: any) => (b.count || 0) - (a.count || 0)),
      );
    } catch (error) {
      console.error('โหลด Pipeline ไม่สำเร็จ:', error);
      setPipelineData([]);
    } finally {
      setIsLoadingPipeline(false);
    }
  };

  const fetchPipelineAndCompanies = async () => {
    await Promise.all([
      fetchPipelineForUser(),
      supabase
        .from('companies')
        .select('id, name, customer_type_id')
        .order('name')
        .limit(500)
        .then(({ data }) => {
          if (data) setCompanies(data);
        }),
    ]);
  };

  const fetchCompanyProjectHistory = async (companyId: string, requestedUserId?: string) => {
    if (!companyId) {
      setCompanyProjectHistory([]);
      return;
    }

    setIsLoadingProjectHistory(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('เซสชันหมดอายุ');

      const query = new URLSearchParams({ company_id: companyId });
      if (requestedUserId) query.set('user_id', requestedUserId);
      const response = await fetch(`/api/visit-plan-project-history?${query.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'โหลดประวัติโปรเจกต์ไม่สำเร็จ');

      setCompanyProjectHistory(Array.isArray(result.projects) ? result.projects : []);
    } catch (error) {
      console.error('โหลดประวัติโครงการไม่สำเร็จ:', error);
      setCompanyProjectHistory([]);
    } finally {
      setIsLoadingProjectHistory(false);
    }
  };

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, project_name')
      .order('project_name');
    if (data) setProjects(data);
  };

  const fetchSalesOrderCounts = async () => {
    if (currentUserRole !== 'admin') return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return;
      const response = await fetch('/api/sales-order-counts', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.counts) setSalesOrderCounts(result.counts);
    } catch (error) {
      console.error('โหลดจำนวนออเดอร์ของเซลส์ไม่สำเร็จ:', error);
    }
  };

  const handleSelectCompany = (companyId: string) => {
    setSelectedCompany(companyId);
    setSelectedProject('');
    setProjectSearch('');
    setConcept('');
    setCompanyProjectHistory([]);
    fetchCompanyProjectHistory(companyId, selectedAssignToUserId || undefined);
  };

  const handleAssignUser = (userId: string) => {
    setSelectedAssignToUserId(userId);
    setIsAssignDropdownOpen(false);
    setAssignSearch('');
    setSelectedCompany('');
    setCompanySearch('');
    setSelectedProject('');
    setProjectSearch('');
    setCompanyProjectHistory([]);
    fetchPipelineForUser(userId || undefined);
  };

  const handleCompanyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      setVisibleCompanyCount(prev => prev + 50);
    }
  };

  const handleProjectScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      setVisibleProjectCount(prev => prev + 50);
    }
  };

  const handleSelectProject = (projectId: string, customProjList?: any[]) => {
    setSelectedProject(projectId);
    setIsProjectDropdownOpen(false);
    
    // Check if it's a pipeline project to auto-fill details
    const pipelineComp = pipelineData.find(p => p.company.id === selectedCompany);
    const projList = customProjList || [
      ...companyProjectHistory,
      ...(pipelineComp ? pipelineComp.projects : []),
      ...projects,
    ];
    const proj = projList.find((p: any) => p.id === projectId);
    
    if (proj) {
      if (proj.project_type_id) setSelectedProjectType(proj.project_type_id);
      if (proj.product_category_id) setSelectedCategory(proj.product_category_id);
      setProjectSearch(proj.project_name);
    } else {
      const genericProj = projects.find(p => p.id === projectId);
      if (genericProj) {
        setProjectSearch(genericProj.project_name);
      }
    }
  };

  const handleAddCompany = async () => {
    const name = newCompanyName.trim();
    if (!name || isAddingCompany) return;
    setIsAddingCompany(true);
    try {
      const { data: existing } = await supabase
        .from('companies')
        .select('id, name, customer_type_id')
        .ilike('name', name)
        .maybeSingle();

      let company = existing;
      if (!company) {
        const { data, error } = await supabase
          .from('companies')
          .insert({ name, customer_type_id: newCustomerTypeId || null })
          .select('id, name, customer_type_id')
          .single();
        if (error) throw error;
        company = data;
      }

      if (company) {
        setCompanies(current => current.some(item => item.id === company.id) ? current : [...current, company]);
        setCompanySearch(company.name);
        handleSelectCompany(company.id);
        setIsAddCompanyOpen(false);
        setNewCompanyName('');
        setNewCustomerTypeId('');
      }
    } catch (error) {
      console.error('เพิ่มบริษัทไม่สำเร็จ:', error);
      alert('เพิ่มบริษัทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsAddingCompany(false);
    }
  };

  const handleAddProject = async () => {
    const projectName = newProjectName.trim();
    if (!projectName || isAddingProject) return;
    setIsAddingProject(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ project_name: projectName }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.project) {
        throw new Error(result.error || 'เพิ่มโปรเจกต์ไม่สำเร็จ');
      }

      const project = result.project;
      setProjects(current => current.some(item => item.id === project.id) ? current : [project, ...current]);
      setSelectedProject(project.id);
      setProjectSearch(project.project_name);
      setIsAddProjectOpen(false);
      setNewProjectName('');
    } catch (error: any) {
      console.error('เพิ่มโปรเจกต์ไม่สำเร็จ:', error);
      alert(error?.message || 'เพิ่มโปรเจกต์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsAddingProject(false);
    }
  };

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [selectedWeekStart, selectedDateRange, dateViewMode]);

  useEffect(() => {
    fetchPipelineAndCompanies();
    fetchProjects();
    fetchSalesOrderCounts();
    fetchPlans();

    // ⚡ Realtime Subscription: ฟังการเปลี่ยนแปลงแผนงานและออเดอร์ เพื่ออัปเดตแบบสดๆ เหมือนในแอป
    const channel = supabase
      .channel('realtime_visit_plans_web')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visit_plans' }, () => {
        fetchPlans();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        fetchPlans();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);



  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('visit_plans')
      .update({ status: newStatus })
      .eq('id', id);
    
    if (!error) {
      setPlans(plans.map(p => p.id === id ? { ...p, status: newStatus } : p));
    }
  };

  const resetForm = () => {
    setSelectedCompany('');
    setCompanySearch('');
    setSelectedProject('');
    setProjectSearch('');
    setSelectedDate('');
    setSelectedStartTime('09:00');
    setSelectedEndTime('10:00');
    setSelectedAssignToUserId('');
    setIsAssignDropdownOpen(false);
    setAssignSearch('');
    setSelectedProjectType('');
    setSelectedCategory('');
    setConcept('');
    setClientRequestId('');
    setCompanyProjectHistory([]);
    setEditingPlanId(null);
    setIsReadOnlyPlan(false);
  };

  const handleEditPlan = (plan: any) => {
    setEditingPlanId(plan.id);
    setIsReadOnlyPlan(plan.status === 'completed');
    setSelectedCompany(plan.company_id || '');
    setCompanySearch(plan.companies?.name || '');
    setSelectedProject(plan.project_id || '');
    setProjectSearch(plan.projects?.project_name || '');
    setSelectedDate(plan.planned_date ? plan.planned_date.split('T')[0] : '');
    setSelectedStartTime(plan.start_time?.slice(0, 5) || '09:00');
    setSelectedEndTime(plan.end_time?.slice(0, 5) || '10:00');
    setSelectedAssignToUserId(plan.user_id || '');
    setSelectedProjectType(plan.project_type_id || '');
    setSelectedCategory(plan.product_category_id || '');
    setConcept(plan.project_concept || '');
    setClientRequestId(plan.client_request_id || '');
    fetchPipelineForUser(plan.user_id || undefined);
    fetchCompanyProjectHistory(plan.company_id || '', plan.user_id || undefined);
    
    setViewPlanDetail(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !selectedDate || isReadOnlyPlan) return;
    if (selectedEndTime <= selectedStartTime) {
      alert('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
      return;
    }
    
    setIsSubmitting(true);
    
    const [{ data: userData }, { data: sessionData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);
    if (!userData.user || !sessionData.session?.access_token) {
      setIsSubmitting(false);
      alert('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      return;
    }

    const requestId = clientRequestId || crypto.randomUUID();
    if (!clientRequestId) setClientRequestId(requestId);
    const targetUserId = currentUserRole === 'admin' && selectedAssignToUserId
      ? selectedAssignToUserId
      : userData.user.id;
    const planPayload = {
      user_id: targetUserId,
      company_id: selectedCompany,
      project_id: selectedProject || null,
      planned_date: selectedDate,
      start_time: `${selectedStartTime}:00`,
      end_time: `${selectedEndTime}:00`,
      client_request_id: requestId,
      project_type_id: selectedProjectType || null,
      product_category_id: selectedCategory || null,
      project_concept: concept.trim() || null,
    };

    try {
      const response = await fetch(
        editingPlanId
          ? `/api/visit-plans?id=${encodeURIComponent(editingPlanId)}`
          : '/api/visit-plans',
        {
          method: editingPlanId ? 'PATCH' : 'POST',
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(planPayload),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || result.details || 'บันทึกแผนงานไม่สำเร็จ');
      }

      setIsModalOpen(false);
      resetForm();
      await fetchPlans(new Date(selectedDate));
    } catch (error: any) {
      console.error('บันทึกแผนงานผ่าน API ไม่สำเร็จ:', error);
      alert(error?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSalesFilter = filterSales !== 'ALL' ? filterSales : selectedUserId;

  const validProfiles = useMemo(() => {
    return profiles.filter(p => {
      const name = (p.full_name || p.username || '').trim();
      return name.length > 0 && name !== 'ไม่มีชื่อ';
    }).sort((profileA, profileB) => {
      const countDifference = (salesOrderCounts[profileB.id] || 0) - (salesOrderCounts[profileA.id] || 0);
      if (countDifference !== 0) return countDifference;
      const nameA = profileA.full_name || profileA.username || '';
      const nameB = profileB.full_name || profileB.username || '';
      return nameA.localeCompare(nameB, 'th');
    });
  }, [profiles, salesOrderCounts]);

  const assignedProfile = useMemo(
    () => validProfiles.find(profile => profile.id === selectedAssignToUserId),
    [validProfiles, selectedAssignToUserId],
  );

  const filteredAssignProfiles = useMemo(() => {
    const search = assignSearch.trim().toLowerCase();
    if (!search) return validProfiles;
    return validProfiles.filter(profile =>
      (profile.full_name || profile.username || '').toLowerCase().includes(search),
    );
  }, [validProfiles, assignSearch]);

  const filteredPlans = useMemo(() => {
    if (activeSalesFilter === 'all' || activeSalesFilter === 'ALL') return plans;
    return plans.filter(p => p.user_id === activeSalesFilter || p.profiles?.id === activeSalesFilter);
  }, [plans, activeSalesFilter]);

  const selectedProfileObj = useMemo(() => {
    return validProfiles.find(p => p.id === activeSalesFilter);
  }, [validProfiles, activeSalesFilter]);

  const selectedWeekIndex = selectedWeekStart
    ? weeks.findIndex(week => week.start.getTime() === selectedWeekStart.getTime())
    : -1;
  const selectedWeek = selectedWeekIndex >= 0 ? weeks[selectedWeekIndex] : weeks[0];
  const displayedDays = useMemo(() => {
    if (dateViewMode === 'range' && selectedDateRange) {
      const start = new Date(selectedDateRange.start);
      const end = new Date(selectedDateRange.end);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const dayCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

      return Array.from({ length: Math.max(dayCount, 0) }, (_, dayIndex) => {
        const date = new Date(start);
        date.setDate(date.getDate() + dayIndex);
        return date;
      });
    }

    return selectedWeek
      ? Array.from({ length: 7 }, (_, dayIndex) => {
          const date = new Date(selectedWeek.start);
          date.setDate(date.getDate() + dayIndex);
          date.setHours(0, 0, 0, 0);
          return date;
        })
      : [];
  }, [dateViewMode, selectedDateRange, selectedWeek]);

  const selectedPeriodLabel = dateViewMode === 'range' && selectedDateRange
    ? `${selectedDateRange.start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} - ${selectedDateRange.end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : selectedWeek?.label || 'เลือกช่วงเวลา';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pickerWeeks = useMemo(() => {
    const monthStart = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), 1);
    const monthEnd = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 0, 23, 59, 59, 999);
    const calendarStart = getMonday(monthStart);
    const rows: { start: Date; end: Date; days: Date[] }[] = [];

    for (let rowIndex = 0; rowIndex < 6; rowIndex++) {
      const start = new Date(calendarStart);
      start.setDate(start.getDate() + rowIndex * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      if (start > monthEnd || end < monthStart) continue;

      rows.push({
        start,
        end,
        days: Array.from({ length: 7 }, (_, dayIndex) => {
          const day = new Date(start);
          day.setDate(day.getDate() + dayIndex);
          return day;
        }),
      });
    }
    return rows;
  }, [pickerMonth]);

  const moveSelectedPeriod = (direction: number) => {
    if (dateViewMode === 'range' && selectedDateRange) {
      const rangeLength = Math.floor(
        (selectedDateRange.end.getTime() - selectedDateRange.start.getTime()) / 86400000
      ) + 1;
      const nextStart = new Date(selectedDateRange.start);
      const nextEnd = new Date(selectedDateRange.end);
      nextStart.setDate(nextStart.getDate() + direction * rangeLength);
      nextEnd.setDate(nextEnd.getDate() + direction * rangeLength);
      setSelectedDateRange({ start: nextStart, end: nextEnd });
      setPickerMonth(new Date(nextStart.getFullYear(), nextStart.getMonth(), 1));
      return;
    }

    const targetWeek = new Date(selectedWeek?.start || getMonday(new Date()));
    targetWeek.setDate(targetWeek.getDate() + direction * 7);
    generateWeeksFromPlans(plans, targetWeek);
  };

  const openWeekPicker = () => {
    const target = dateViewMode === 'range' && selectedDateRange
      ? selectedDateRange.start
      : selectedWeek?.start || new Date();
    setPickerMonth(new Date(target.getFullYear(), target.getMonth(), 1));
    setPickerMode(dateViewMode);
    setDraftRangeStart(selectedDateRange?.start || null);
    setDraftRangeEnd(selectedDateRange?.end || null);
    setIsWeekPickerOpen(true);
  };

  const selectRangeDay = (day: Date) => {
    const selectedDay = new Date(day);
    selectedDay.setHours(0, 0, 0, 0);

    if (!draftRangeStart || draftRangeEnd) {
      setDraftRangeStart(selectedDay);
      setDraftRangeEnd(null);
      return;
    }

    if (selectedDay < draftRangeStart) {
      setDraftRangeStart(selectedDay);
      setDraftRangeEnd(draftRangeStart);
      return;
    }

    setDraftRangeEnd(selectedDay);
  };

  const applySelectedRange = () => {
    if (!draftRangeStart || !draftRangeEnd) return;
    setSelectedDateRange({ start: new Date(draftRangeStart), end: new Date(draftRangeEnd) });
    setDateViewMode('range');
    setIsWeekPickerOpen(false);
  };

  return (
    <div className="bg-white rounded-none border border-slate-200 shadow-sm overflow-visible flex flex-col mt-8 w-full">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center bg-slate-50 gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="text-indigo-600" />
          <div>
            <h3 className="font-bold text-slate-800 text-lg">
              แผนการเข้าพบลูกค้า
            </h3>
            {activeSalesFilter !== 'all' && activeSalesFilter !== 'ALL' && selectedProfileObj && (
              <p className="text-xs font-semibold text-emerald-600">
                กรองตามเซลส์: {selectedProfileObj.full_name}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto min-w-0">
          <div className="relative flex items-center shadow-sm">
            <button
              type="button"
              onClick={() => moveSelectedPeriod(-1)}
              className="h-10 w-10 flex-shrink-0 flex items-center justify-center border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 cursor-pointer"
              aria-label="สัปดาห์ก่อนหน้า"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              onClick={openWeekPicker}
              className="h-10 min-w-[230px] px-4 border-y border-slate-200 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 cursor-pointer flex items-center justify-center gap-2 text-sm font-bold"
            >
              <Calendar size={16} className="text-indigo-600" />
              <span>{selectedPeriodLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => moveSelectedPeriod(1)}
              className="h-10 w-10 flex-shrink-0 flex items-center justify-center border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 cursor-pointer"
              aria-label="สัปดาห์ถัดไป"
            >
              <ChevronRight size={17} />
            </button>

            {isWeekPickerOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsWeekPickerOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-12 z-40 w-[440px] max-w-[calc(100vw-2rem)] border border-slate-200 bg-white p-4 shadow-2xl">
                  <div className="mb-4 grid grid-cols-2 bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setPickerMode('week')}
                      className={`h-9 text-xs font-bold transition-colors cursor-pointer ${
                        pickerMode === 'week'
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      เลือกทั้งวีค
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPickerMode('range');
                        setDraftRangeStart(selectedDateRange?.start || null);
                        setDraftRangeEnd(selectedDateRange?.end || null);
                      }}
                      className={`h-9 text-xs font-bold transition-colors cursor-pointer ${
                        pickerMode === 'range'
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      เลือกช่วงวันที่
                    </button>
                  </div>

                  <div className="mb-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setPickerMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                      className="h-8 w-8 flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer"
                      aria-label="เดือนก่อนหน้า"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-800">
                        {pickerMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {pickerMode === 'week'
                          ? 'เลือกทั้งแถวเพื่อดูสัปดาห์นั้น'
                          : draftRangeStart && !draftRangeEnd
                          ? 'เลือกวันสิ้นสุด'
                          : 'เลือกวันเริ่มต้นและวันสิ้นสุด'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPickerMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                      className="h-8 w-8 flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer"
                      aria-label="เดือนถัดไป"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-1 px-1 pb-2 text-center text-[10px] font-bold text-slate-400">
                    <span>{pickerMode === 'week' ? 'ช่วง' : 'วีค'}</span>
                    {['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map(day => <span key={day}>{day}</span>)}
                  </div>

                  <div className="space-y-1">
                    {pickerWeeks.map((week, weekIndex) => {
                      const isSelected = selectedWeek?.start.getTime() === week.start.getTime();
                      const weekPlanCount = filteredPlans.filter(plan => {
                        const planDate = new Date(plan.planned_date);
                        return planDate >= week.start && planDate <= week.end;
                      }).length;

                      if (pickerMode === 'week') return (
                        <button
                          key={week.start.getTime()}
                          type="button"
                          onClick={() => {
                            generateWeeksFromPlans(plans, week.start);
                            setDateViewMode('week');
                            setIsWeekPickerOpen(false);
                          }}
                          className={`grid w-full grid-cols-[72px_repeat(7,minmax(0,1fr))] items-center gap-1 border p-1.5 text-center transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-transparent hover:border-indigo-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`text-left text-[11px] font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>
                            วีค {weekIndex + 1}
                            <small className="ml-1 text-[9px] text-slate-400">({weekPlanCount})</small>
                          </span>
                          {week.days.map(day => {
                            const isCurrentMonth = day.getMonth() === pickerMonth.getMonth();
                            const isToday = day.getTime() === today.getTime();
                            return (
                              <span
                                key={day.toISOString()}
                                className={`mx-auto flex h-7 w-7 items-center justify-center text-[11px] ${
                                  isToday
                                    ? 'bg-indigo-600 font-bold text-white'
                                    : isCurrentMonth
                                    ? 'text-slate-700'
                                    : 'text-slate-300'
                                }`}
                              >
                                {day.getDate()}
                              </span>
                            );
                          })}
                        </button>
                      );

                      return (
                        <div
                          key={week.start.getTime()}
                          className="grid w-full grid-cols-[72px_repeat(7,minmax(0,1fr))] items-center gap-1 border border-transparent p-1.5 text-center"
                        >
                          <span className="text-left text-[11px] font-bold text-slate-500">
                            วีค {weekIndex + 1}
                          </span>
                          {week.days.map(day => {
                            const dayTime = day.getTime();
                            const isCurrentMonth = day.getMonth() === pickerMonth.getMonth();
                            const isToday = dayTime === today.getTime();
                            const isRangeStart = dayTime === draftRangeStart?.getTime();
                            const isRangeEnd = dayTime === draftRangeEnd?.getTime();
                            const isInsideRange = Boolean(
                              draftRangeStart &&
                              draftRangeEnd &&
                              dayTime > draftRangeStart.getTime() &&
                              dayTime < draftRangeEnd.getTime()
                            );

                            return (
                              <button
                                key={day.toISOString()}
                                type="button"
                                onClick={() => selectRangeDay(day)}
                                className={`mx-auto flex h-8 w-8 items-center justify-center text-[11px] font-semibold transition-colors cursor-pointer ${
                                  isRangeStart || isRangeEnd
                                    ? 'bg-indigo-600 text-white'
                                    : isInsideRange
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : isCurrentMonth
                                    ? 'text-slate-700 hover:bg-indigo-50'
                                    : 'text-slate-300 hover:bg-slate-50'
                                } ${isToday && !isRangeStart && !isRangeEnd ? 'ring-1 ring-inset ring-indigo-500' : ''}`}
                                aria-label={day.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                              >
                                {day.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  {pickerMode === 'range' && (
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <div className="min-w-0 text-[11px] text-slate-500">
                        {draftRangeStart ? (
                          <p className="truncate font-semibold text-slate-700">
                            {draftRangeStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' - '}
                            {draftRangeEnd
                              ? draftRangeEnd.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
                              : 'เลือกวันสิ้นสุด'}
                          </p>
                        ) : (
                          <p>กรุณาเลือกวันเริ่มต้น</p>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {draftRangeStart && (
                          <button
                            type="button"
                            onClick={() => {
                              setDraftRangeStart(null);
                              setDraftRangeEnd(null);
                            }}
                            className="h-9 px-3 text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
                          >
                            ล้าง
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={applySelectedRange}
                          disabled={!draftRangeStart || !draftRangeEnd}
                          className="h-9 bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                        >
                          แสดงช่วงนี้
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setDateViewMode('week');
              generateWeeksFromPlans(plans, new Date());
            }}
            className="h-10 px-3 border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            สัปดาห์นี้
          </button>
          <button 
            onClick={() => {
              resetForm();
              const todayDate = new Date();
              const currentWeekStart = getMonday(todayDate);
              const defaultDate = selectedWeek?.start.getTime() === currentWeekStart.getTime()
                ? todayDate
                : selectedWeek?.start || todayDate;
              setSelectedDate(toDateInputValue(defaultDate));
              if (currentUserRole === 'admin' && activeSalesFilter !== 'all' && activeSalesFilter !== 'ALL') {
                setSelectedAssignToUserId(activeSalesFilter);
                fetchPipelineForUser(activeSalesFilter);
              }
              setIsModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-none flex items-center gap-2 text-sm transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} /> สร้างแผน
          </button>
        </div>
      </div>

      {/* Content (Horizontal Board) */}
      <div className="p-0 bg-slate-50/50 min-h-[300px] relative">
        {loading && plans.length === 0 ? (
           <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
             <Loader2 className="animate-spin text-indigo-500" size={32} />
           </div>
        ) : (
          <div 
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className="flex gap-4 overflow-x-auto p-4 snap-x snap-mandatory cursor-grab [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] select-none" 
          >
            {displayedDays.map((day) => {
              const dayEnd = new Date(day);
              dayEnd.setHours(23, 59, 59, 999);
              const dayPlans = filteredPlans.filter(p => {
                const d = new Date(p.planned_date);
                return d >= day && d <= dayEnd;
              });
              const dayTime = day.getTime();
              const isPast = dayTime < today.getTime();
              const isToday = dayTime === today.getTime();
              const isFuture = dayTime > today.getTime();
              
              let headerColorClass = '';
              let badgeElement = null;
              
              if (isPast) {
                headerColorClass = 'bg-slate-200 text-slate-500 border-slate-300';
                badgeElement = <span className="bg-slate-300 text-slate-700 text-[10px] px-2 py-0.5 rounded-none font-bold">ผ่านมาแล้ว</span>;
              } else if (isToday) {
                headerColorClass = 'bg-indigo-50 text-indigo-800 border-indigo-500';
                badgeElement = <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-none font-bold shadow-sm">วันนี้</span>;
              } else if (isFuture) {
                headerColorClass = 'bg-sky-50 text-sky-700 border-sky-300';
                badgeElement = <span className="bg-sky-200 text-sky-800 text-[10px] px-2 py-0.5 rounded-none font-bold">ล่วงหน้า</span>;
              }

              return (
                <div key={day.toISOString()} className="flex-shrink-0 w-72 snap-start flex flex-col">
                  <div className={`p-3 border-b-2 font-bold mb-3 sticky top-0 z-10 flex justify-between items-center ${headerColorClass}`}>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm">
                        {day.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </span>
                      <div className="flex items-center gap-2">
                        {badgeElement}
                      </div>
                    </div>
                    <span className="text-xs bg-white/60 px-2 py-0.5 font-bold rounded-none border border-black/10">{dayPlans.length}</span>
                  </div>
                  
                    <div className="flex flex-col gap-2 min-h-[150px] max-h-[440px] overflow-y-auto pr-1 bg-slate-50/50 p-2 border border-slate-100 h-full custom-scrollbar">
                      {dayPlans.length === 0 ? (
                         <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center px-4">
                            <Calendar size={28} className="opacity-20 mb-2" />
                            <span className="text-xs font-medium leading-relaxed">
                              ไม่มีแผนเข้าพบวันนี้
                            </span>
                         </div>
                      ) : (
                      dayPlans.map(plan => {
                        const displayStatus = planDisplayStatus(plan);
                        const overdue = displayStatus === 'overdue';
                        return (<div
                          key={plan.id} 
                          onClick={() => setViewPlanDetail(plan)}
                          className={`flex items-center justify-between gap-2 p-2.5 border cursor-pointer hover:shadow-md transition-all rounded-none w-full ${
                            overdue ? 'bg-red-50 border-red-200 hover:border-red-400' :
                            plan.status === 'completed' ? 'bg-emerald-50 border-emerald-200' : 
                            plan.status === 'cancelled' ? 'bg-slate-50 border-slate-200 opacity-70' : 
                            'bg-white border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold text-[13px] truncate ${overdue ? 'text-red-800' : plan.status === 'completed' ? 'text-emerald-800' : 'text-slate-700'}`}>
                              {plan.companies?.name || 'ไม่ระบุบริษัท'}
                            </p>
                            {plan.projects?.project_name && (
                              <p className={`text-[10px] truncate mt-0.5 ${plan.status === 'completed' ? 'text-emerald-600/70' : 'text-slate-500'}`}>
                                {plan.projects.project_name}
                              </p>
                            )}
                            <div className="flex items-center justify-between gap-1.5 mt-2 pt-2 border-t border-black/5 text-[11px]">
                              <span className={`font-semibold flex items-center gap-1 ${overdue ? 'text-red-600' : 'text-emerald-600'}`}>
                                <Clock size={12} className={overdue ? 'text-red-500' : 'text-emerald-500'} />
                                {plan.start_time
                                  ? `${plan.start_time.slice(0, 5)} - ${plan.end_time?.slice(0, 5) || '--:--'} น.`
                                  : 'ไม่ระบุเวลา'}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate max-w-[100px]" title={plan.profiles?.full_name || ''}>
                                {plan.profiles?.full_name || 'ไม่ระบุ'}
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex items-center justify-center pl-2">
                            {overdue && <span className="rounded-none bg-red-100 px-1.5 py-1 text-[10px] font-bold text-red-700">เลยกำหนด</span>}
                            {!overdue && plan.status === 'completed' && <CheckCircle2 size={16} className="text-emerald-500" />}
                            {plan.status === 'cancelled' && <XCircle size={16} className="text-slate-400" />}
                            {!overdue && plan.status === 'pending' && <Clock size={16} className="text-amber-500" />}
                          </div>
                        </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-4 sm:p-5">
              <h3 className="font-bold text-xl text-slate-800">
                {editingPlanId ? 'แก้ไขแผนงาน' : 'สร้างแผนการเข้าพบลูกค้า'}
              </h3>
              <button onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }} className="text-slate-400 hover:text-red-500 transition">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">วันที่เข้าพบ <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  required
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">เวลาเข้าพบ <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-400">ตั้งแต่</span>
                    <input
                      type="time"
                      required
                      value={selectedStartTime}
                      onChange={(event) => setSelectedStartTime(event.target.value)}
                      className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
                    />
                  </label>
                  <label className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-400">ถึง</span>
                    <input
                      type="time"
                      required
                      value={selectedEndTime}
                      onChange={(event) => setSelectedEndTime(event.target.value)}
                      className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
                    />
                  </label>
                </div>
              </div>

              {currentUserRole === 'admin' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">มอบหมายให้</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAssignDropdownOpen(open => !open)}
                      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm outline-none transition hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-indigo-600">
                        <User size={16} />
                        {assignedProfile?.avatar_url && (
                          <img
                            src={assignedProfile.avatar_url}
                            alt={assignedProfile.full_name || assignedProfile.username || 'รูปโปรไฟล์'}
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={event => { event.currentTarget.style.display = 'none'; }}
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-700">
                        {assignedProfile
                          ? assignedProfile.full_name || assignedProfile.username
                          : 'ตัวเอง'}
                      </span>
                      <ChevronRight size={16} className={`text-slate-400 transition-transform ${isAssignDropdownOpen ? '-rotate-90' : 'rotate-90'}`} />
                    </button>

                    {isAssignDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsAssignDropdownOpen(false)} />
                        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                          <div className="border-b border-slate-100 p-2">
                            <input
                              autoFocus
                              value={assignSearch}
                              onChange={event => setAssignSearch(event.target.value)}
                              placeholder="ค้นหาชื่อเซลส์..."
                              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="max-h-64 overflow-y-auto py-1">
                            <button
                              type="button"
                              onClick={() => handleAssignUser('')}
                              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-indigo-50 ${!selectedAssignToUserId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                            >
                              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                <User size={16} />
                              </span>
                              <span className="font-semibold">ตัวเอง</span>
                            </button>

                            {filteredAssignProfiles.map(profile => (
                              <button
                                key={profile.id}
                                type="button"
                                onClick={() => handleAssignUser(profile.id)}
                                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-indigo-50 ${selectedAssignToUserId === profile.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                              >
                                <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-indigo-600">
                                  <User size={16} />
                                  {profile.avatar_url && (
                                    <img
                                      src={profile.avatar_url}
                                      alt={profile.full_name || profile.username || 'รูปโปรไฟล์'}
                                      className="absolute inset-0 h-full w-full object-cover"
                                      onError={event => { event.currentTarget.style.display = 'none'; }}
                                    />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {profile.full_name || profile.username}
                                </span>
                              </button>
                            ))}
                            {filteredAssignProfiles.length === 0 && (
                              <p className="px-3 py-5 text-center text-xs text-slate-400">ไม่พบรายชื่อเซลส์</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {isLoadingPipeline && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-indigo-500">
                      <Loader2 size={12} className="animate-spin" /> กำลังโหลด Pipeline ของเซลส์...
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">บริษัท <span className="text-red-500">*</span></label>
                <div className="flex items-start gap-2">
                  <div className="relative flex-1">
                  <input
                    type="text"
                    required={!selectedCompany}
                    placeholder="ค้นหา/เลือกบริษัท"
                    value={companySearch}
                    onChange={(e) => {
                      setCompanySearch(e.target.value);
                      if (selectedCompany) setSelectedCompany('');
                      setIsCompanyDropdownOpen(true);
                      setVisibleCompanyCount(50);
                    }}
                    onFocus={() => {
                      setIsCompanyDropdownOpen(true);
                      setVisibleCompanyCount(50);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                  />
                  {isCompanyDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-[5]" onClick={() => setIsCompanyDropdownOpen(false)} />
                      <div 
                        className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto"
                        onScroll={handleCompanyScroll}
                      >
                        {(() => {
                          // เมื่อเลือกบริษัทแล้ว ให้ชื่อคงอยู่ในช่อง แต่เปิดรายการทั้งหมดได้ทันที
                          // การเริ่มพิมพ์ใหม่จะล้าง selectedCompany และกลับมาใช้ข้อความค้นหาตามปกติ
                          const searchLower = selectedCompany ? '' : companySearch.toLowerCase();
                          const filteredPipeline = pipelineData.filter(p => p.company.name.toLowerCase().includes(searchLower));
                          const pipelineIds = new Set(pipelineData.map(p => p.company.id));
                          const otherCompanies = companies.filter(c => !pipelineIds.has(c.id) && c.name.toLowerCase().includes(searchLower));
                          
                          if (filteredPipeline.length === 0 && otherCompanies.length === 0) {
                             return <div className="p-3 text-slate-500 text-sm text-center">ไม่พบบริษัท</div>;
                          }

                          return (
                            <>
                              {filteredPipeline.length > 0 && (
                                <div className="px-3 py-2 bg-slate-50 font-bold text-xs text-slate-500">บริษัทที่ดูแลอยู่</div>
                              )}
                              {filteredPipeline.map(p => (
                                <div 
                                  key={`pipe-${p.company.id}`}
                                  onClick={() => {
                                    handleSelectCompany(p.company.id);
                                    setCompanySearch(p.company.name);
                                    setIsCompanyDropdownOpen(false);
                                  }}
                                  className={`p-3 text-sm cursor-pointer hover:bg-indigo-50 border-b border-slate-50 last:border-0 flex justify-between items-center ${selectedCompany === p.company.id ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-slate-700'}`}
                                >
                                  <span>{p.company.name}</span>
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                    {p.projects.length} โครงการ
                                  </span>
                                </div>
                              ))}
                              
                              {otherCompanies.length > 0 && (
                                <div className="px-3 py-2 bg-slate-50 font-bold text-xs text-slate-500">บริษัททั่วไป</div>
                              )}
                              {otherCompanies.slice(0, visibleCompanyCount).map(c => (
                                <div 
                                  key={`other-${c.id}`}
                                  onClick={() => {
                                    handleSelectCompany(c.id);
                                    setCompanySearch(c.name);
                                    setIsCompanyDropdownOpen(false);
                                  }}
                                  className={`p-3 text-sm cursor-pointer hover:bg-indigo-50 border-b border-slate-50 last:border-0 flex justify-between items-center ${selectedCompany === c.id ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-slate-700'}`}
                                >
                                  {c.name}
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                    </>
                  )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddCompanyOpen(true)}
                    className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50"
                    title="เพิ่มบริษัทใหม่"
                  >
                    <Plus size={19} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">โครงการ</label>
                <div className="flex items-start gap-2">
                  <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="ค้นหา/เลือกโครงการ"
                    value={projectSearch}
                    onChange={(e) => {
                      setProjectSearch(e.target.value);
                      if (selectedProject) setSelectedProject('');
                      setIsProjectDropdownOpen(true);
                      setVisibleProjectCount(50);
                    }}
                    onFocus={() => {
                      setIsProjectDropdownOpen(true);
                      setVisibleProjectCount(50);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition text-sm"
                  />
                  {isProjectDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-[5]" onClick={() => setIsProjectDropdownOpen(false)} />
                      <div 
                        className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto"
                        onScroll={handleProjectScroll}
                      >
                        {(() => {
                          // หลักการเดียวกับบริษัท: ชื่อที่เลือกไม่ควรบังคับให้รายการเหลือแค่ชื่อนั้น
                          const searchLower = selectedProject ? '' : projectSearch.toLowerCase();
                          const pipelineCompany = pipelineData.find(item => item.company.id === selectedCompany);
                          const normalizedProjectName = (project: any) => String(project?.project_name || '')
                            .trim()
                            .replace(/\s+/g, ' ');
                          const isSelectableProject = (project: any) => {
                            const name = normalizedProjectName(project);
                            return name.length > 0 && name !== '-' && name !== 'ไม่ระบุโครงการ' && name !== 'ไม่มีการระบุโครงการ';
                          };
                          const uniqueProjectsByName = (projectList: any[]) => {
                            const names = new Set<string>();
                            return projectList.filter(project => {
                              const key = normalizedProjectName(project).toLowerCase();
                              if (names.has(key)) return false;
                              names.add(key);
                              return true;
                            });
                          };
                          const prioritizedMap = new Map<string, any>();
                          companyProjectHistory.forEach(project => prioritizedMap.set(project.id, project));
                          (pipelineCompany?.projects || []).forEach((project: any) => {
                            if (!prioritizedMap.has(project.id)) prioritizedMap.set(project.id, project);
                          });
                          const prioritizedProjects = uniqueProjectsByName(
                            Array.from(prioritizedMap.values()).filter(project =>
                              isSelectableProject(project) && normalizedProjectName(project).toLowerCase().includes(searchLower),
                            ),
                          );
                          const myProjects = prioritizedProjects.filter(project => project.is_mine === true);
                          const companyProjects = prioritizedProjects.filter(project => project.is_mine !== true);
                          const prioritizedNames = new Set(prioritizedProjects.map(project => normalizedProjectName(project).toLowerCase()));
                          const otherProjs = uniqueProjectsByName(
                            projects.filter(project =>
                              !pipelineProjIds.has(project.id) &&
                              !prioritizedNames.has(normalizedProjectName(project).toLowerCase()) &&
                              isSelectableProject(project) &&
                              normalizedProjectName(project).toLowerCase().includes(searchLower),
                            ),
                          );
                          
                          if (isLoadingProjectHistory) {
                            return (
                              <div className="flex items-center justify-center gap-2 p-4 text-xs text-indigo-500">
                                <Loader2 size={14} className="animate-spin" /> กำลังโหลดประวัติโครงการ...
                              </div>
                            );
                          }

                          if (myProjects.length === 0 && companyProjects.length === 0 && otherProjs.length === 0) {
                             return <div className="p-3 text-slate-500 text-sm text-center">ไม่พบโครงการ</div>;
                          }

                          return (
                            <>
                              <div 
                                onClick={() => {
                                  setSelectedProject('');
                                  setProjectSearch('');
                                  setIsProjectDropdownOpen(false);
                                }}
                                className="p-3 text-sm cursor-pointer hover:bg-slate-100 border-b border-slate-50 text-slate-500 italic"
                              >
                                -- ไม่ระบุโครงการ หรือ โครงการใหม่ --
                              </div>
                              
                              {myProjects.length > 0 && (
                                <div className="px-3 py-2 bg-amber-50 font-bold text-xs text-amber-700">★ โปรเจกต์ของเซลส์ที่เลือก</div>
                              )}
                              {myProjects.map(p => (
                                <div 
                                  key={`mine-proj-${p.id}`}
                                  onClick={() => handleSelectProject(p.id, prioritizedProjects)}
                                  className={`p-3 text-sm cursor-pointer hover:bg-indigo-50 border-b border-slate-50 last:border-0 ${selectedProject === p.id ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-slate-700'}`}
                                >
                                  <span className="flex items-center justify-between gap-2">
                                    <span>{p.project_name}</span>
                                    <span className="text-amber-500">★</span>
                                  </span>
                                </div>
                              ))}

                              {companyProjects.length > 0 && (
                                <div className="px-3 py-2 bg-slate-50 font-bold text-xs text-slate-500">โปรเจกต์อื่นของบริษัทนี้</div>
                              )}
                              {companyProjects.map(p => (
                                <div
                                  key={`company-proj-${p.id}`}
                                  onClick={() => handleSelectProject(p.id, prioritizedProjects)}
                                  className={`p-3 text-sm cursor-pointer hover:bg-indigo-50 border-b border-slate-50 last:border-0 ${selectedProject === p.id ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-slate-700'}`}
                                >
                                  {p.project_name}
                                </div>
                              ))}
                              
                              {otherProjs.length > 0 && (
                                <div className="px-3 py-2 bg-slate-50 font-bold text-xs text-slate-500">โครงการทั้งหมดในระบบ</div>
                              )}
                              {otherProjs.slice(0, visibleProjectCount).map(p => (
                                <div 
                                  key={`other-proj-${p.id}`}
                                  onClick={() => handleSelectProject(p.id)}
                                  className={`p-3 text-sm cursor-pointer hover:bg-indigo-50 border-b border-slate-50 last:border-0 ${selectedProject === p.id ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-slate-700'}`}
                                >
                                  {p.project_name}
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                    </>
                  )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddProjectOpen(true)}
                    className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50"
                    title="เพิ่มโปรเจกต์ใหม่"
                  >
                    <Plus size={19} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">ประเภทโครงการ</label>
                  <select 
                    value={selectedProjectType}
                    onChange={(e) => setSelectedProjectType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition text-sm"
                  >
                    <option value="">ไม่ระบุ</option>
                    {projectTypes.map(pt => (
                      <option key={pt.id} value={pt.id}>{pt.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">หมวดหมู่สินค้า</label>
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition text-sm"
                  >
                    <option value="">ไม่ระบุ</option>
                    {productCategories.map(pc => (
                      <option key={pc.id} value={pc.id}>{pc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">แนวโครงการ (Concept / Notes)</label>
                <textarea 
                  rows={3}
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="รายละเอียดเพิ่มเติม เช่น โปรเจ็กต์โรงแรม 5 ดาว..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition resize-none"
                ></textarea>
              </div>

              {isReadOnlyPlan && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                  รายการนี้เสร็จสิ้นแล้ว จึงไม่สามารถแก้ไขได้
                </div>
              )}

              <div className="sticky bottom-0 z-[2] -mx-4 -mb-4 flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-white px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:pb-6">
                <button 
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="w-full rounded-lg px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-100 sm:w-auto"
                >
                  ยกเลิก
                </button>
                {isReadOnlyPlan ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    className="w-full rounded-lg bg-slate-700 px-5 py-2.5 font-bold text-white transition hover:bg-slate-800 sm:w-auto"
                  >
                    ปิดหน้าต่าง
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
                    {editingPlanId ? 'บันทึกการแก้ไข' : 'บันทึกแผนงาน'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddCompanyOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setIsAddCompanyOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">เพิ่มบริษัทใหม่</h3>
              <button type="button" onClick={() => setIsAddCompanyOpen(false)} className="text-slate-400 hover:text-red-500">
                <X size={21} />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">ประเภทลูกค้า</label>
                <select
                  value={newCustomerTypeId}
                  onChange={event => setNewCustomerTypeId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="">ไม่ระบุ</option>
                  {customerTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">ชื่อบริษัท <span className="text-red-500">*</span></label>
                <input
                  autoFocus
                  value={newCompanyName}
                  onChange={event => setNewCompanyName(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddCompany();
                    }
                  }}
                  placeholder="กรอกชื่อบริษัท"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setIsAddCompanyOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">ยกเลิก</button>
                <button
                  type="button"
                  onClick={handleAddCompany}
                  disabled={!newCompanyName.trim() || isAddingCompany}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  {isAddingCompany && <Loader2 size={15} className="animate-spin" />} บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddProjectOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setIsAddProjectOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">เพิ่มโปรเจกต์ใหม่</h3>
              <button type="button" onClick={() => setIsAddProjectOpen(false)} className="text-slate-400 hover:text-red-500">
                <X size={21} />
              </button>
            </div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">ชื่อโปรเจกต์ <span className="text-red-500">*</span></label>
            <input
              autoFocus
              value={newProjectName}
              onChange={event => setNewProjectName(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddProject();
                }
              }}
              placeholder="กรอกชื่อโปรเจกต์"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setIsAddProjectOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">ยกเลิก</button>
              <button
                type="button"
                onClick={handleAddProject}
                disabled={!newProjectName.trim() || isAddingProject}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                {isAddingProject && <Loader2 size={15} className="animate-spin" />} บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewPlanDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewPlanDetail(null)}>
          <div className="bg-white rounded-none w-full max-w-md shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-bold text-xl text-slate-800">รายละเอียดแผนงาน</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleEditPlan(viewPlanDetail)}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-bold bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-none transition"
                >
                  แก้ไข
                </button>
                <button onClick={() => setViewPlanDetail(null)} className="text-slate-400 hover:text-red-500 transition">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 flex flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <span className="font-bold text-lg text-slate-800 flex items-start gap-2 leading-tight">
                  <Building2 size={20} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                  {viewPlanDetail.companies?.name || 'ไม่ระบุบริษัท'}
                </span>
                <div className="flex-shrink-0 pt-0.5">
                  {planDisplayStatus(viewPlanDetail) === 'completed' && <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-none text-xs font-bold whitespace-nowrap">สำเร็จแล้ว</span>}
                  {viewPlanDetail.status === 'cancelled' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-none text-xs font-bold whitespace-nowrap">ยกเลิก</span>}
                  {planDisplayStatus(viewPlanDetail) === 'overdue' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-none text-xs font-bold whitespace-nowrap">เลยกำหนด</span>}
                  {planDisplayStatus(viewPlanDetail) === 'pending' && <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-none text-xs font-bold whitespace-nowrap">รอดำเนินการ</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 mb-1">วันที่เข้าพบ</p>
                  <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock size={16} className="text-slate-400" />
                    {new Date(viewPlanDetail.planned_date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">ผู้รับผิดชอบ</p>
                  <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <User size={16} className="text-slate-400" />
                    {viewPlanDetail.profiles?.full_name || 'ไม่ระบุ'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500 mb-1">เวลาเข้าพบ</p>
                  <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock size={16} className="text-slate-400" />
                    {viewPlanDetail.start_time
                      ? `${viewPlanDetail.start_time.slice(0, 5)} - ${viewPlanDetail.end_time?.slice(0, 5) || '--:--'} น.`
                      : 'ไม่ระบุเวลา'}
                  </p>
                </div>
              </div>

              {(viewPlanDetail.projects?.project_name || viewPlanDetail.project_types?.name || viewPlanDetail.product_categories?.name) && (
                <div className="bg-slate-50 p-4 rounded-none border border-slate-100">
                  <p className="font-bold text-slate-700 mb-3 text-sm">ข้อมูลโครงการ</p>
                  <div className="flex flex-col gap-2 text-sm">
                    {viewPlanDetail.projects?.project_name && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">โครงการ:</span>
                        <span className="font-semibold text-indigo-700 text-right">{viewPlanDetail.projects.project_name}</span>
                      </div>
                    )}
                    {viewPlanDetail.project_types?.name && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">ประเภท:</span>
                        <span className="font-medium text-slate-700 text-right">{viewPlanDetail.project_types.name}</span>
                      </div>
                    )}
                    {viewPlanDetail.product_categories?.name && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">หมวดหมู่:</span>
                        <span className="font-medium text-slate-700 text-right">{viewPlanDetail.product_categories.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewPlanDetail.project_concept && (
                <div>
                  <p className="text-slate-500 mb-1.5 text-sm">แนวโครงการ / โน้ตเพิ่มเติม</p>
                  <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-none text-sm text-slate-700 italic">
                    "{viewPlanDetail.project_concept}"
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
