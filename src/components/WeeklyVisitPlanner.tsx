"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, CheckCircle2, XCircle, Plus, ChevronLeft, ChevronRight, 
  Clock, Building2, User, Loader2, X
} from 'lucide-react';

interface Props {
  projectTypes: any[];
  productCategories: any[];
  currentUserRole: string;
}

export default function WeeklyVisitPlanner({ projectTypes, productCategories, currentUserRole }: Props) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Get Monday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0,0,0,0);
    return monday;
  });

  const [plans, setPlans] = useState<any[]>([]);
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

  const fetchPlans = async () => {
    setLoading(true);
    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23,59,59,999);

    const startIso = currentWeekStart.toISOString();
    const endIso = endOfWeek.toISOString();

    const { data, error } = await supabase
      .from('visit_plans')
      .select(`
        id, planned_date, project_concept, status, user_id, company_id, project_id, project_type_id, product_category_id,
        profiles (id, full_name),
        companies (id, name),
        projects (id, project_name),
        project_types (id, name),
        product_categories (id, name)
      `)
      .gte('planned_date', startIso)
      .lte('planned_date', endIso)
      .order('planned_date', { ascending: true });

    if (!error && data) {
      // -------------------------------------------------------------
      // AUTO-COMPLETE LOGIC:
      // If a user checked-in (created an order) for this company 
      // during this same week, automatically mark the plan as completed.
      // -------------------------------------------------------------
      const { data: weekOrders } = await supabase
        .from('orders')
        .select('company_id, user_id')
        .gte('created_at', startIso)
        .lte('created_at', endIso);

      const processedPlans = data.map((plan: any) => {
        if (plan.status === 'pending' && weekOrders) {
          const hasCheckIn = weekOrders.some(
            (o: any) => o.company_id === plan.company_id && o.user_id === plan.user_id
          );
          if (hasCheckIn) {
            // Update DB in background (Fire and forget)
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
      const { data: orders } = await supabase
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

      if (orders) {
        const compMap = new Map();
        orders.forEach(order => {
          if (!order.companies || !order.company_id) return;
          const cId = order.company_id;
          if (!compMap.has(cId)) {
            compMap.set(cId, { company: order.companies, projects: [], count: 0 });
          }
          const compData = compMap.get(cId);
          
          order.order_items?.forEach((item: any) => {
            item.order_item_projects?.forEach((proj: any) => {
              if (proj.project_name) {
                compData.count += 1;
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

        // Algorithm: Sort companies by the number of active projects they have
        const pipeline = Array.from(compMap.values()).sort((a, b) => b.count - a.count);
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
    fetchPlans();
  }, [currentWeekStart]);

  useEffect(() => {
    fetchPipelineAndCompanies();
    fetchProjects();
  }, []);

  const handlePrevWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const getWeekLabel = () => {
    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    
    const startStr = currentWeekStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    const endStr = endOfWeek.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    return `${startStr} - ${endStr}`;
  };

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
        fetchPlans();
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
        fetchPlans();
      } else {
          alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-8 w-full">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 gap-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
          <Calendar className="text-indigo-600" /> แผนการเข้าพบลูกค้า (Weekly Visit Plan)
        </h3>
        
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
            <button onClick={handlePrevWeek} className="p-1 hover:bg-slate-100 rounded text-slate-600 transition">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">
              {getWeekLabel()}
            </span>
            <button onClick={handleNextWeek} className="p-1 hover:bg-slate-100 rounded text-slate-600 transition">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <button 
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm transition-colors shadow-sm"
          >
            <Plus size={16} /> สร้างแผน
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-0 sm:p-5 bg-slate-50/50 min-h-[300px] relative">
        {loading ? (
           <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
             <Loader2 className="animate-spin text-indigo-500" size={32} />
           </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar size={48} className="text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">ยังไม่มีแผนเข้าพบลูกค้าในสัปดาห์นี้</p>
            <p className="text-slate-400 text-sm mt-1">กดปุ่ม "สร้างแผน" เพื่อเริ่มต้นวางแผนของคุณ</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 p-4 sm:p-0">
            {plans.map((plan) => (
              <div 
                key={plan.id} 
                onClick={() => setViewPlanDetail(plan)}
                className={`flex items-center justify-between gap-2 p-2 rounded-xl border cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all w-full sm:w-[260px] ${
                  plan.status === 'completed' ? 'bg-emerald-50 border-emerald-200' : 
                  plan.status === 'cancelled' ? 'bg-slate-50 border-slate-200 opacity-70' : 
                  'bg-white border-slate-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-xs truncate ${plan.status === 'completed' ? 'text-emerald-800' : 'text-slate-700'}`}>
                    {plan.companies?.name || 'ไม่ระบุบริษัท'}
                  </p>
                  {plan.projects?.project_name && (
                    <p className={`text-[10px] truncate mt-0.5 ${plan.status === 'completed' ? 'text-emerald-600/70' : 'text-slate-500'}`}>
                      {plan.projects.project_name}
                    </p>
                  )}
                </div>

                <div className="flex-shrink-0 flex items-center justify-center pl-2">
                  {plan.status === 'completed' && <CheckCircle2 size={16} className="text-emerald-500" />}
                  {plan.status === 'cancelled' && <XCircle size={16} className="text-slate-400" />}
                  {plan.status === 'pending' && <Clock size={16} className="text-amber-500" />}
                </div>
              </div>
            ))}
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
                    placeholder="พิมพ์ค้นหา หรือเลือกจากบริษัทที่คุณดูแลอยู่..."
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
                                <div className="px-3 py-2 bg-slate-50 font-bold text-xs text-slate-500">🌟 บริษัทที่คุณดูแลอยู่ (My Pipeline)</div>
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
                                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                    {p.projects.length} โปรเจ็กต์
                                  </span>
                                </div>
                              ))}
                              
                              {otherCompanies.length > 0 && (
                                <div className="px-3 py-2 bg-slate-50 font-bold text-xs text-slate-500">🏢 บริษัทอื่นๆ</div>
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
                <label className="block text-sm font-bold text-slate-700 mb-1.5">โครงการ (Project จากระบบ)</label>
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
                                <div className="px-3 py-2 bg-slate-50 font-bold text-xs text-slate-500">🌟 โครงการที่ทำกับบริษัทนี้</div>
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
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-bold text-xl text-slate-800">รายละเอียดแผนงาน</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleEditPlan(viewPlanDetail)}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-bold bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition"
                >
                  แก้ไข
                </button>
                <button onClick={() => setViewPlanDetail(null)} className="text-slate-400 hover:text-red-500 transition">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <Building2 size={20} className="text-indigo-500" />
                  {viewPlanDetail.companies?.name || 'ไม่ระบุบริษัท'}
                </span>
                {viewPlanDetail.status === 'completed' && <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">สำเร็จแล้ว</span>}
                {viewPlanDetail.status === 'cancelled' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">ยกเลิก</span>}
                {viewPlanDetail.status === 'pending' && <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">รอดำเนินการ</span>}
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
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
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
                  <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-lg text-sm text-slate-700 italic">
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
