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
  currentUserRole: string;
  profiles?: any[];
}

export default function WeeklyVisitPlanner({ projectTypes, productCategories, currentUserRole, profiles = [] }: Props) {
  const [weeks, setWeeks] = useState<{ start: Date, end: Date, label: string }[]>([]);
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
  const [selectedProjectType, setSelectedProjectType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [concept, setConcept] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [viewPlanDetail, setViewPlanDetail] = useState<any | null>(null);

  // Pipeline Data State (Algorithm)
  const [pipelineData, setPipelineData] = useState<any[]>([]);

  const pipelineProjIds = useMemo(() => {
    const comp = pipelineData.find(p => p.company.id === selectedCompany);
    return new Set(comp ? comp.projects.map((p: any) => p.id) : []);
  }, [selectedCompany, pipelineData]);
  
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

    const calculatedWeeks = [];
    for (let w = new Date(startBound); w <= endBound; w.setDate(w.getDate() + 7)) {
      const start = new Date(w);
      const end = new Date(w);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const label = `${start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`;
      calculatedWeeks.push({ start, end, label });
    }

    setWeeks(calculatedWeeks);
  };

  const fetchPlans = async (targetWeekToFocus?: Date) => {
    setLoading(true);

    // ดึงแผนงานทั้งหมดมาคำนวณสัปดาห์แบบ Dynamic
    const { data, error } = await supabase
      .from('visit_plans')
      .select(`
        id, planned_date, project_concept, status, user_id, company_id, project_id, project_type_id, product_category_id,
        profiles (id, full_name, avatar_url, email),
        companies (id, name),
        projects (id, project_name),
        project_types (id, name),
        product_categories (id, name)
      `)
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

  const fetchPipelineAndCompanies = async () => {
    const { data: userData } = await supabase.auth.getUser();
    
    // 1. Fetch User's Active Pipeline (Orders -> Order Items -> Projects)
    if (userData?.user) {
      console.log("Current Logged-in User ID:", userData.user.id);
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          company_id,
          companies (id, name),
          order_items (
            product_category_id,
            order_item_projects (
              id, project_name, project_type_id
            )
          )
        `)
        .eq('user_id', userData.user.id);
        
      console.log("Orders fetched for user:", orders?.length, "Error:", error);

      if (orders) {
        const compMap = new Map();
        orders.forEach(order => {
          if (!order.companies || !order.company_id) return;
          const cId = order.company_id;
          if (!compMap.has(cId)) {
            compMap.set(cId, { company: order.companies, projects: [], count: 0 });
          }
          const compData = compMap.get(cId);
          
          // Increment count for every order (represents a visit)
          compData.count += 1;
          
          order.order_items?.forEach((item: any) => {
            item.order_item_projects?.forEach((proj: any) => {
              if (proj.project_name) {
                // Avoid duplicate projects by name
                if (!compData.projects.find((p: any) => p.project_name === proj.project_name)) {
                  compData.projects.push({
                    id: proj.id,
                    project_name: proj.project_name,
                    project_type_id: proj.project_type_id,
                    product_category_id: item.product_category_id
                  });
                }
              }
            });
          });
        });

        // Algorithm: Sort companies by the number of orders/visits (count)
        const pipeline = Array.from(compMap.values()).sort((a, b) => b.count - a.count);
        console.log("Final Pipeline Size:", pipeline.length, "Pipeline Data:", pipeline);
        setPipelineData(pipeline);
      }
    }

    // 2. Fetch all companies as fallback
    const { data: allC } = await supabase.from('companies').select('id, name').order('name').limit(500);
    if (allC) setCompanies(allC);
  };

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, project_name')
      .order('project_name');
    if (data) setProjects(data);
  };

  const handleSelectCompany = (companyId: string) => {
    setSelectedCompany(companyId);
    setSelectedProject('');
    setConcept('');
    
    const pipelineComp = pipelineData.find(p => p.company.id === companyId);
    if (pipelineComp && pipelineComp.projects.length === 1) {
      handleSelectProject(pipelineComp.projects[0].id, pipelineComp.projects);
    }
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
    const projList = customProjList || (pipelineComp ? pipelineComp.projects : []);
    const proj = projList.find((p: any) => p.id === projectId);
    
    if (proj) {
      if (proj.project_type_id) setSelectedProjectType(proj.project_type_id);
      if (proj.product_category_id) setSelectedCategory(proj.product_category_id);
      setConcept(proj.project_name);
      setProjectSearch(proj.project_name);
    } else {
      // If it's a generic project, maybe just set the concept to its name
      const genericProj = projects.find(p => p.id === projectId);
      if (genericProj) {
        setConcept(genericProj.project_name);
        setProjectSearch(genericProj.project_name);
      }
    }
  };

  useEffect(() => {
    if (weeks.length > 0 && scrollContainerRef.current) {
      const currentMonday = getMonday(new Date());
      const currentWeekIndex = weeks.findIndex(w => getMonday(w.start).getTime() === currentMonday.getTime());
      const targetIndex = currentWeekIndex !== -1 ? currentWeekIndex : 0;
      
      const child = scrollContainerRef.current.children[targetIndex] as HTMLElement;
      if (child) {
        setTimeout(() => {
          scrollContainerRef.current?.scrollTo({ left: child.offsetLeft - 16, behavior: 'smooth' });
        }, 100);
      }
    }
  }, [weeks, plans.length]);

  useEffect(() => {
    fetchPipelineAndCompanies();
    fetchProjects();
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
    setSelectedProjectType('');
    setSelectedCategory('');
    setConcept('');
    setEditingPlanId(null);
  };

  const handleEditPlan = (plan: any) => {
    setEditingPlanId(plan.id);
    setSelectedCompany(plan.company_id || '');
    setCompanySearch(plan.companies?.name || '');
    setSelectedProject(plan.project_id || '');
    setProjectSearch(plan.projects?.project_name || '');
    setSelectedDate(plan.planned_date ? plan.planned_date.split('T')[0] : '');
    setSelectedProjectType(plan.project_type_id || '');
    setSelectedCategory(plan.product_category_id || '');
    setConcept(plan.project_concept || '');
    
    setViewPlanDetail(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !selectedDate) return;
    
    setIsSubmitting(true);
    
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
        setIsSubmitting(false);
        return;
    }

    if (editingPlanId) {
      const { error } = await supabase
        .from('visit_plans')
        .update({
          company_id: selectedCompany,
          project_id: selectedProject || null,
          planned_date: selectedDate,
          project_type_id: selectedProjectType || null,
          product_category_id: selectedCategory || null,
          project_concept: concept
        })
        .eq('id', editingPlanId);

      setIsSubmitting(false);
      if (!error) {
        setIsModalOpen(false);
        resetForm();
        fetchPlans(new Date(selectedDate));
      } else {
        alert('เกิดข้อผิดพลาดในการแก้ไขข้อมูล');
      }
    } else {
      const { error } = await supabase
        .from('visit_plans')
        .insert({
          user_id: userData.user.id,
          company_id: selectedCompany,
          project_id: selectedProject || null,
          planned_date: selectedDate,
          project_type_id: selectedProjectType || null,
          product_category_id: selectedCategory || null,
          project_concept: concept
        });

      setIsSubmitting(false);
      if (!error) {
        setIsModalOpen(false);
        resetForm();
        fetchPlans(new Date(selectedDate));
      } else {
          alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
      }
    }
  };

  const validProfiles = useMemo(() => {
    return profiles.filter(p => {
      const name = (p.full_name || p.username || '').trim();
      return name.length > 0 && name !== 'ไม่มีชื่อ';
    });
  }, [profiles]);

  const filteredPlans = useMemo(() => {
    if (selectedUserId === 'all') return plans;
    return plans.filter(p => p.user_id === selectedUserId || p.profiles?.id === selectedUserId);
  }, [plans, selectedUserId]);

  const selectedProfileObj = useMemo(() => {
    return validProfiles.find(p => p.id === selectedUserId);
  }, [validProfiles, selectedUserId]);

  return (
    <div className="bg-white rounded-none border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-8 w-full">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="text-indigo-600" />
          <div>
            <h3 className="font-bold text-slate-800 text-lg">
              แผนการเข้าพบลูกค้า
            </h3>
            {selectedUserId !== 'all' && selectedProfileObj && (
              <p className="text-xs font-semibold text-emerald-600">
                กำลังดูแผนงานของ: {selectedProfileObj.full_name}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* 🔍 ฟิลเตอร์เลือกดูตามเซลส์ */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-none text-xs shadow-sm">
            {selectedProfileObj?.avatar_url ? (
              <img src={selectedProfileObj.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <User size={14} className="text-slate-400" />
            )}
            <span className="text-slate-500 font-medium">ดูตามเซลส์:</span>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="all">ทั้งหมด (ทุกคน)</option>
              {validProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => {
              resetForm();
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
            {weeks.map((week, index) => {
              const weekPlans = filteredPlans.filter(p => {
                const d = new Date(p.planned_date);
                return d >= week.start && d <= week.end;
              });
              const weekMondayTime = getMonday(week.start).getTime();
              const isPast = weekMondayTime < currentMondayTime;
              const isCurrentWeek = weekMondayTime === currentMondayTime;
              const isFuture = weekMondayTime > currentMondayTime;
              
              let headerColorClass = '';
              let badgeElement = null;
              
              if (isPast) {
                headerColorClass = 'bg-slate-200 text-slate-500 border-slate-300';
                badgeElement = <span className="bg-slate-300 text-slate-700 text-[10px] px-2 py-0.5 rounded-none font-bold">ผ่านมาแล้ว</span>;
              } else if (isCurrentWeek) {
                headerColorClass = 'bg-indigo-50 text-indigo-800 border-indigo-500';
                badgeElement = <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-none font-bold shadow-sm">สัปดาห์นี้</span>;
              } else if (isFuture) {
                headerColorClass = 'bg-sky-50 text-sky-700 border-sky-300';
                badgeElement = <span className="bg-sky-200 text-sky-800 text-[10px] px-2 py-0.5 rounded-none font-bold">ล่วงหน้า</span>;
              }

              return (
                <div key={index} className="flex-shrink-0 w-80 snap-start flex flex-col">
                  <div className={`p-3 border-b-2 font-bold mb-3 sticky top-0 z-10 flex justify-between items-center ${headerColorClass}`}>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm">{week.label}</span>
                      <div className="flex items-center gap-2">
                        {badgeElement}
                      </div>
                    </div>
                    <span className="text-xs bg-white/60 px-2 py-0.5 font-bold rounded-none border border-black/10">{weekPlans.length}</span>
                  </div>
                  
                    <div className="flex flex-col gap-2 min-h-[150px] bg-slate-50/50 p-2 border border-slate-100 h-full">
                      {weekPlans.length === 0 ? (
                         <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center px-4">
                            <Calendar size={28} className="opacity-20 mb-2" />
                            <span className="text-xs font-medium leading-relaxed">
                              {index === 0
                                ? "ไม่มีแผนงานที่เก่ากว่านี้"
                                : index === weeks.length - 1
                                ? "ไม่มีแผนที่ใหม่กว่านี้\nสามารถสร้างแผนใหม่ได้"
                                : "ไม่มีแผนเข้าพบ"}
                            </span>
                         </div>
                      ) : (
                      weekPlans.map(plan => (
                        <div 
                          key={plan.id} 
                          onClick={() => setViewPlanDetail(plan)}
                          className={`flex items-center justify-between gap-2 p-2.5 border cursor-pointer hover:shadow-md transition-all rounded-none w-full ${
                            plan.status === 'completed' ? 'bg-emerald-50 border-emerald-200' : 
                            plan.status === 'cancelled' ? 'bg-slate-50 border-slate-200 opacity-70' : 
                            'bg-white border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold text-[13px] truncate ${plan.status === 'completed' ? 'text-emerald-800' : 'text-slate-700'}`}>
                              {plan.companies?.name || 'ไม่ระบุบริษัท'}
                            </p>
                            {plan.projects?.project_name && (
                              <p className={`text-[10px] truncate mt-0.5 ${plan.status === 'completed' ? 'text-emerald-600/70' : 'text-slate-500'}`}>
                                {plan.projects.project_name}
                              </p>
                            )}
                            <div className="flex items-center justify-between gap-1.5 mt-2 pt-2 border-t border-black/5 text-[11px]">
                              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                                <Clock size={12} className="text-emerald-500" />
                                {new Date(plan.planned_date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate max-w-[100px]" title={plan.profiles?.full_name || ''}>
                                {plan.profiles?.full_name || 'ไม่ระบุ'}
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex items-center justify-center pl-2">
                            {plan.status === 'completed' && <CheckCircle2 size={16} className="text-emerald-500" />}
                            {plan.status === 'cancelled' && <XCircle size={16} className="text-slate-400" />}
                            {plan.status === 'pending' && <Clock size={16} className="text-amber-500" />}
                          </div>
                        </div>
                      ))
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
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
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
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
                <label className="block text-sm font-bold text-slate-700 mb-1.5">บริษัท <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    required={!selectedCompany}
                    placeholder="พิมพ์ค้นหา หรือเลือกจากบริษัท..."
                    value={companySearch}
                    onChange={(e) => {
                      setCompanySearch(e.target.value);
                      if (selectedCompany) setSelectedCompany('');
                      setIsCompanyDropdownOpen(true);
                      setVisibleCompanyCount(50);
                    }}
                    onFocus={() => setIsCompanyDropdownOpen(true)}
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
                          const searchLower = companySearch.toLowerCase();
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
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">โครงการ</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="พิมพ์ค้นหา หรือเลือกจากโครงการ..."
                    value={projectSearch}
                    onChange={(e) => {
                      setProjectSearch(e.target.value);
                      if (selectedProject) setSelectedProject('');
                      setIsProjectDropdownOpen(true);
                      setVisibleProjectCount(50);
                    }}
                    onFocus={() => setIsProjectDropdownOpen(true)}
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
                          const searchLower = projectSearch.toLowerCase();
                          const pipelineProjs = projects.filter(p => pipelineProjIds.has(p.id) && p.project_name.toLowerCase().includes(searchLower));
                          const otherProjs = projects.filter(p => !pipelineProjIds.has(p.id) && p.project_name.toLowerCase().includes(searchLower));
                          
                          if (pipelineProjs.length === 0 && otherProjs.length === 0) {
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
                              
                              {pipelineProjs.length > 0 && (
                                <div className="px-3 py-2 bg-slate-50 font-bold text-xs text-slate-500">โครงการที่ทำกับบริษัทนี้</div>
                              )}
                              {pipelineProjs.map(p => (
                                <div 
                                  key={`pipe-proj-${p.id}`}
                                  onClick={() => handleSelectProject(p.id)}
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

              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
                  {editingPlanId ? 'บันทึกการแก้ไข' : 'บันทึกแผนงาน'}
                </button>
              </div>
            </form>
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
                  {viewPlanDetail.status === 'completed' && <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-none text-xs font-bold whitespace-nowrap">สำเร็จแล้ว</span>}
                  {viewPlanDetail.status === 'cancelled' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-none text-xs font-bold whitespace-nowrap">ยกเลิก</span>}
                  {viewPlanDetail.status === 'pending' && <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-none text-xs font-bold whitespace-nowrap">รอดำเนินการ</span>}
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
