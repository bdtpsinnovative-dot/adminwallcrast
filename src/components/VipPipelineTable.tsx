'use client';
import { useState, useEffect, useTransition, useMemo } from 'react'; 
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Star, List, Map, ArrowDownWideNarrow, ArrowUpNarrowWide, 
  User, Target, Trophy, Maximize2, LayoutList, BarChart3, 
  CalendarDays, Smartphone, FileText,
  Edit2, Check, X, Loader2, Save, Scaling, Lock, Unlock
} from 'lucide-react'; 

interface Props {
  projects: any[];
  profilesMap: Record<string, string>;
  salesStats: any[];
  customerTypes: { id: string; name: string }[]; 
  projectTypes: { id: string; name: string }[];
  productCategories: { id: string; name: string }[];
  onRefresh?: () => void;
}

function EditProjectModal({ isOpen, data, onClose, projectTypes, productCategories, onRefresh }: any) {
  // 🌟 ดึงค่าปี ค.ศ. ปัจจุบัน มาตั้งเป็นค่าเริ่มต้น และค่าต่ำสุด
  const currentYearAD = new Date().getFullYear().toString();

  const [formData, setFormData] = useState({
    projectName: '',
    note: '',
    area: '0',
    customerName: '',
    projectTypeId: '',
    categoryId: '',
    queueLevel: '', 
    projectYear: currentYearAD,
    salesNote: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSalesNoteEditable, setIsSalesNoteEditable] = useState(false);

  useEffect(() => {
    if (isOpen && data) {
      // ดึงปีมาจาก DB ถ้ามี ถ้าน้อยกว่าปีปัจจุบัน ให้บังคับโชว์ปีที่ดึงมาได้ (แต่เวลาแก้จะโดน min บังคับใหม่)
      const dbYear = data.proj.project_year?.toString();
      
      setFormData({
        projectName: data.proj.project_name || '',
        note: data.proj.project_note || '',
        area: data.proj.area_sqm?.toString() || '0',
        customerName: data.order?.customer_name || '',
        projectTypeId: data.proj.project_type_id || '',
        categoryId: data.item?.product_category_id || '',
        queueLevel: data.proj.queue_level || '', 
        projectYear: dbYear || currentYearAD,
        salesNote: data.item?.note || ''
      });
      setIsSalesNoteEditable(false);
    }
  }, [isOpen, data, currentYearAD]);

  if (!isOpen) return null;

  // 🌟 ฟังก์ชันสรุปการเปลี่ยนแปลง
  const getChangesSummary = (oldData: any, newData: any) => {
    const changes = [];
    
    if ((oldData.projectName || '') !== newData.projectName) 
      changes.push(`ชื่อโครงการเป็น "${newData.projectName || '-'}"`);
      
    if (String(oldData.area || '0') !== String(newData.area || '0')) 
      changes.push(`พื้นที่เป็น "${newData.area} ตร.ม."`);
      
    if (String(oldData.queueLevel || '') !== String(newData.queueLevel || '')) 
      changes.push(`quarter "quarter ${newData.queueLevel}"`);
      
    if (String(oldData.projectYear || '') !== String(newData.projectYear || '')) 
      changes.push(`ปีเป็น "${newData.projectYear}"`);
      
    if ((oldData.note || '') !== newData.note) {
      const shortNote = newData.note.length > 20 ? newData.note.substring(0, 20) + '...' : newData.note;
      changes.push(`คอมเมนต์: "${shortNote}"`);
    }

    if ((oldData.salesNote || '') !== newData.salesNote) {
      const shortSalesNote = newData.salesNote.length > 20 ? newData.salesNote.substring(0, 20) + '...' : newData.salesNote;
      changes.push(`โน้ตจากเซลส์: "${shortSalesNote}"`);
    }
    
    return changes.length > 0 ? `อัปเดต: ${changes.join(', ')}` : `แอดมินอัปเดตข้อมูลโครงการ ${newData.projectName || 'ไม่ระบุชื่อ'} เรียบร้อยแล้ว`;
  };

  const handleSave = async () => {
    try {
      setIsSaving(true); 
      
      // 1. บันทึกข้อมูลลงตารางโปรเจกต์
      const projectUpdate = supabase.from('order_item_projects').update({ 
        project_name: formData.projectName.trim() || null,
        project_note: formData.note.trim() || null,
        area_sqm: Number(formData.area) || 0,
        project_type_id: formData.projectTypeId || null,
        queue_level: formData.queueLevel || null, 
        project_year: formData.projectYear.trim() || null 
      }).eq('id', data.proj.id);

      let orderUpdate = null;
      if (data.order?.id) {
        orderUpdate = supabase.from('orders').update({ 
          customer_name: formData.customerName.trim() || null 
        }).eq('id', data.order.id);
      }

      let itemUpdate = null;
      if (data.item?.id) {
        itemUpdate = supabase.from('order_items').update({ 
          product_category_id: formData.categoryId || null,
          note: formData.salesNote.trim() || null
        }).eq('id', data.item.id);
      }

      const [projRes, ordRes, itemRes] = await Promise.all([
        projectUpdate, 
        orderUpdate ? orderUpdate : Promise.resolve({ error: null }), 
        itemUpdate ? itemUpdate : Promise.resolve({ error: null })
      ]);

      if (projRes.error) throw projRes.error;
      if (ordRes.error) throw ordRes.error;
      if (itemRes.error) throw itemRes.error;

      // 🌟 2. ระบบแจ้งเตือน (บันทึกลง DB + ยิง FCM)
      try {
        const targetUserId = data.order?.user_id; // ไอดีเซลส์
        const orderId = data.order?.id; // ไอดีออเดอร์เพื่อลิงก์

        if (targetUserId) {
          const titleMsg = 'มีการอัปเดตข้อมูลโครงการ 🔔';
          
          // 🌟 เรียกใช้ฟังก์ชันดึงรายละเอียดการเปลี่ยนแปลง
          const bodyMsg = getChangesSummary(
            { 
              projectName: data.proj.project_name,
              area: data.proj.area_sqm,
              queueLevel: data.proj.queue_level,
              projectYear: data.proj.project_year,
              note: data.proj.project_note,
              salesNote: data.item?.note
            },
            formData
          );

          // 2.1 หา ID ของแอดมินที่กำลังกดเซฟ (creator_id)
          const { data: authData } = await supabase.auth.getUser();
          const adminId = authData?.user?.id;

          // 2.2 💾 Insert ลงตาราง notifications ตามโครงสร้าง
          const { error: notifError } = await supabase
            .from('notifications')
            .insert({
              recipient_id: targetUserId,
              creator_id: adminId || null,
              title: titleMsg,
              body: bodyMsg,
              order_id: orderId || null
            });
            
          if (notifError) console.error("DB Notification Error:", notifError);

          // 2.3 🚀 ดึง FCM Tokens และส่งแจ้งเตือนผ่าน API ตัวกลาง
          const { data: profileData } = await supabase
            .from('profiles')
            .select('fcm_tokens') 
            .eq('id', targetUserId)
            .single();

          const fcmData = profileData?.fcm_tokens; 
          
          let fcmTokens: string[] = [];
          if (fcmData && Array.isArray(fcmData)) {
            fcmTokens = fcmData.map((item: any) => item.token).filter(Boolean);
          }
          
          if (fcmTokens.length > 0) {
            await fetch('/api/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: targetUserId,
                tokens: fcmTokens, 
                title: titleMsg,
                body: bodyMsg,
                data: {
                  type: 'project_update',
                  project_id: data.proj.id,
                  order_id: orderId
                }
              })
            }).catch(e => console.error("Fetch Local API Error:", e));
          }
        }
      } catch (notifyError) {
        console.error("Notify Logic Error:", notifyError);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      onRefresh(); 
      onClose(); 
    } catch (error) { 
      console.error(error); 
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลครับ");
    } finally { 
      setIsSaving(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 relative">
        
        {isSaving && (
          <div className="absolute inset-0 z-50 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center">
            <Loader2 size={48} className="text-indigo-600 animate-spin mb-4" />
            <p className="text-indigo-800 font-black text-lg animate-pulse">กำลังอัปเดตข้อมูล...</p>
            <p className="text-slate-500 text-sm font-medium mt-1">กรุณารอสักครู่ครับ</p>
          </div>
        )}

        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
            <Edit2 size={18} className="text-indigo-600" /> แก้ไขข้อมูลโครงการ
          </h3>
          <button onClick={onClose} disabled={isSaving} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">ชื่อโครงการ</label>
              <input type="text" value={formData.projectName} onChange={(e) => setFormData({...formData, projectName: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-medium text-slate-700" placeholder="ระบุชื่อโครงการ..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">ชื่อลูกค้า</label>
              <input type="text" value={formData.customerName} onChange={(e) => setFormData({...formData, customerName: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 font-medium text-slate-700" placeholder="ระบุชื่อลูกค้า..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">พื้นที่ (ตร.ม.)</label>
              <input type="number" value={formData.area} onChange={(e) => setFormData({...formData, area: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 font-bold text-emerald-600" />
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 text-amber-600">Quarter</label>
                <select value={formData.queueLevel} onChange={(e) => setFormData({...formData, queueLevel: e.target.value})} className="w-full border border-amber-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-400 font-bold text-amber-700 appearance-none bg-amber-50">
                  <option value="">Q</option>
                  <option value="1">Q 1</option>
                  <option value="2">Q 2</option>
                  <option value="3">Q 3</option>
                  <option value="4">Q 4</option>
                </select>
              </div>
              <div>
                {/* 🌟 เปลี่ยน Label และเพิ่ม min ควบคุมปี */}
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 text-amber-600">ค.ศ. (คาดการณ์)</label>
                <input 
                  type="number" 
                  min={currentYearAD} // 🌟 บังคับไม่ให้พิมพ์ปีที่ต่ำกว่าปีปัจจุบัน
                  placeholder={`เช่น ${currentYearAD}`} 
                  value={formData.projectYear} 
                  onChange={(e) => setFormData({...formData, projectYear: e.target.value})} 
                  className="w-full border border-amber-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-400 font-bold text-amber-700 bg-amber-50" 
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">ประเภทโครงการ</label>
              <select value={formData.projectTypeId} onChange={(e) => setFormData({...formData, projectTypeId: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-medium text-slate-700 appearance-none bg-white">
                <option value="">- เลือกระบุ -</option>
                <option value="null">- ไม่ระบุ -</option>
                {projectTypes.map((pt: any) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">หมวดหมู่สินค้า</label>
              <select value={formData.categoryId} onChange={(e) => setFormData({...formData, categoryId: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 font-medium text-slate-700 appearance-none bg-white">
                <option value="">- เลือกระบุ -</option>
                {productCategories.map((cat: any) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-sky-700 uppercase tracking-wide">โน้ตจากเซลส์</label>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  {isSalesNoteEditable ? (
                    <>
                      <Unlock size={10} className="text-emerald-500" /> แก้ไขได้
                    </>
                  ) : (
                    <>
                      <Lock size={10} className="text-slate-400" /> ดับเบิ้ลคลิกเพื่อแก้
                    </>
                  )}
                </span>
              </div>
              <textarea 
                value={formData.salesNote} 
                onChange={(e) => setFormData({...formData, salesNote: e.target.value})} 
                onDoubleClick={() => setIsSalesNoteEditable(true)}
                readOnly={!isSalesNoteEditable}
                className={`w-full border rounded-lg px-3 py-2.5 outline-none font-medium text-sm transition-all
                  ${isSalesNoteEditable 
                    ? 'border-sky-400 focus:ring-2 focus:ring-sky-100 bg-white text-slate-700 cursor-text' 
                    : 'border-slate-200 bg-slate-50/80 text-slate-500 cursor-default select-text'
                  } resize-none min-h-[175px]`} 
                placeholder={isSalesNoteEditable ? "ระบุโน้ตจากเซลส์..." : "ไม่มีโน้ตจากเซลส์ (ดับเบิ้ลคลิกเพื่อแก้ไข)"} 
                title={isSalesNoteEditable ? "" : "ดับเบิ้ลคลิกเพื่อเริ่มแก้ไข"}
              />
            </div>
          </div>

          <div className="col-span-1 md:col-span-2 mt-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">หมายเหตุ / คอมเมนต์</label>
            <textarea value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} className="w-full border border-indigo-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-indigo-100 bg-indigo-50/30 resize-none min-h-[100px] text-slate-700" placeholder="พิมพ์หมายเหตุเพิ่มเติมที่นี่..." />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 mt-auto relative z-40">
          <button onClick={onClose} disabled={isSaving} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50">ยกเลิก</button>
          <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-70">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VipPipelineTable({ projects, profilesMap, salesStats, customerTypes = [], projectTypes = [], productCategories = [], onRefresh }: Props) {
  const router = useRouter();
  
  const [isPending, startTransition] = useTransition();

  const [viewMode, setViewMode] = useState<'projects' | 'performance'>('projects');
  const [tab, setTab] = useState(2);
  const [sortArea, setSortArea] = useState<'desc' | 'asc' | 'none'>('none');
  const [sortBySales, setSortBySales] = useState<'projects' | 'area'>('projects');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeEditItem, setActiveEditItem] = useState<any>(null);

  const [sizeFilter, setSizeFilter] = useState<'all' | 'M' | 'L' | 'XL'>('all');
  
  const handleFilterChange = (setter: any, value: any) => {
    startTransition(() => {
      setter(value);
    });
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear() + 543; 
    return `${day}/${month}/${year}`;
  };

  const handleToggleVip = async (projId: string, currentIsVip: boolean) => {
    if (!projId) return;
    try {
      setLoadingId(projId);
      const newVipStatus = !currentIsVip;
      const { error } = await supabase.from('order_item_projects').update({ is_important: newVipStatus }).eq('id', projId);
      if (error) throw error;
      if (onRefresh) {
        onRefresh();
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("Error updating VIP status:", error);
      alert("เกิดข้อผิดพลาดในการอัปเดตดาวครับ");
    } finally { setLoadingId(null); }
  };

  const displayProjects = useMemo(() => {
    let filtered = projects.filter(proj => {
      const isVip = proj.is_important === true || proj.is_important === 'true' || proj.is_important === 1;
      const pName = proj.project_name ? proj.project_name.trim() : "";
      const isNoName = !pName || pName === "" || pName === "-" || pName.includes("ไม่มีการระบุโครงการ") || pName.includes("ไม่ระบุ");

      let passTab = true;
      if (tab === 1) passTab = isVip;       
      if (tab === 2) passTab = true;        
      if (tab === 3) passTab = !isNoName;   
      if (tab === 4) passTab = isNoName;    

      if (!passTab) return false;

      const area = Number(proj.area_sqm) || 0;
      
      if (sizeFilter === 'M') return area >= 1 && area <= 50;
      if (sizeFilter === 'L') return area >= 51 && area <= 100;
      if (sizeFilter === 'XL') return area > 100;

      return true;
    });

    return filtered.sort((a, b) => {
      const areaA = Number(a.area_sqm) || 0;
      const areaB = Number(b.area_sqm) || 0;
      if (sortArea === 'desc') return areaB - areaA;
      if (sortArea === 'asc') return areaA - areaB;
      return 0; 
    });
  }, [projects, tab, sizeFilter, sortArea]); 

  const sortedSalesStats = useMemo(() => {
    return [...salesStats].sort((a, b) => {
      if (sortBySales === 'projects') return b.projects - a.projects;
      if (sortBySales === 'area') return b.area - a.area;
      return 0;
    });
  }, [salesStats, sortBySales]);

  const getRoleColor = (roleName: string) => {
    const name = roleName.toLowerCase();
    if (name.includes('dev')) return 'bg-blue-100 text-blue-700';
    if (name.includes('arch')) return 'bg-purple-100 text-purple-700';
    if (name.includes('interior')) return 'bg-pink-100 text-pink-700';
    if (name.includes('contractor')) return 'bg-orange-100 text-orange-700';
    if (name.includes('office')) return 'bg-emerald-100 text-emerald-700';
    return 'bg-slate-100 text-slate-700'; 
  };

  const getActiveAccount = (proj: any) => {
    for (const type of customerTypes) {
      const key = `account_${type.name.toLowerCase()}`;
      const accountName = proj[key];

      if (accountName && typeof accountName === 'string' && accountName.trim()) {
        return { role: type.name, name: accountName.trim(), color: getRoleColor(type.name) };
      }
    }
    return null;
  };

  return (
    <>
      <div className="w-full bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col mb-8">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${viewMode === 'projects' ? 'bg-rose-500' : 'bg-indigo-600'} text-white shadow-lg`}>
                {viewMode === 'projects' ? <LayoutList size={24} /> : <BarChart3 size={24} />}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800">
                  {viewMode === 'projects' ? 'ระบบติดตามโครงการ (Project Tracker)' : 'ผลงานทีมปฏิบัติการขาย (Sales Ranking)'}
                </h2>
                <p className="text-slate-500 text-sm font-medium">จัดการข้อมูลและวิเคราะห์ผลงานแบบรวมศูนย์</p>
              </div>
            </div>

            <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner">
              <button
                onClick={() => setViewMode('projects')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'projects' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Star size={16} fill={viewMode === 'projects' ? "currentColor" : "none"} /> ข้อมูลโปรเจกต์
              </button>
              <button
                onClick={() => setViewMode('performance')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'performance' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Trophy size={16} /> อันดับเซลส์
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-between items-center gap-4">
            {viewMode === 'projects' ? (
              <>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleFilterChange(setTab, 1)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${tab === 1 ? 'bg-yellow-400 text-yellow-900 border-yellow-400 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                      <Star size={14} fill={tab === 1 ? "currentColor" : "none"} /> โครงการติดดาว
                    </button>
                    <button onClick={() => handleFilterChange(setTab, 2)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${tab === 2 ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>ทั้งหมด</button>
                    <button onClick={() => handleFilterChange(setTab, 3)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${tab === 3 ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50'}`}>ทั้งหมด แบบมีโครงการ</button>
                    <button onClick={() => handleFilterChange(setTab, 4)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${tab === 4 ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50'}`}>ทั้งหมด แบบไม่มีโครงการ</button>
                  </div>

                  <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Scaling size={14}/> ขนาด:</span>
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-sm">
                      <button onClick={() => handleFilterChange(setSizeFilter, 'all')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sizeFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>ทั้งหมด</button>
                      <button onClick={() => handleFilterChange(setSizeFilter, 'M')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sizeFilter === 'M' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-sky-600'}`}>M (1-50)</button>
                      <button onClick={() => handleFilterChange(setSizeFilter, 'L')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sizeFilter === 'L' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-indigo-600'}`}>L (51-100)</button>
                      <button onClick={() => handleFilterChange(setSizeFilter, 'XL')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sizeFilter === 'XL' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-violet-600'}`}>XL (100+)</button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                  <button onClick={() => handleFilterChange(setSortArea, sortArea === 'desc' ? 'none' : 'desc')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${sortArea === 'desc' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}><ArrowDownWideNarrow size={14} /> มากไปน้อย</button>
                  <button onClick={() => handleFilterChange(setSortArea, sortArea === 'asc' ? 'none' : 'asc')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${sortArea === 'asc' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}><ArrowUpNarrowWide size={14} /> น้อยไปมาก</button>
                </div>
              </>
            ) : (
              <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                <button onClick={() => handleFilterChange(setSortBySales, 'projects')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${sortBySales === 'projects' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Trophy size={14} /> จำนวนงานเยอะสุด</button>
                <button onClick={() => handleFilterChange(setSortBySales, 'area')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${sortBySales === 'area' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Maximize2 size={14} /> พื้นที่รวมเยอะสุด</button>
              </div>
            )}
          </div>
        </div>

        <div className={`overflow-x-auto overflow-y-auto max-h-[600px] transition-opacity duration-300 ${isPending ? 'opacity-30' : 'opacity-100'}`}>
          {viewMode === 'projects' ? (
            <table className="w-full text-left text-sm table-fixed min-w-[1800px]">
              <thead className="text-slate-500 text-xs uppercase font-black tracking-widest sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[7%]">วันที่</th>
                  <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[8%]">เซลส์</th>
                  <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[10%]">ผู้ดูแล (ACCOUNT)</th>
                  <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[14%]">โปรเจกต์</th>
                  
                  {/* 🌟 แยก 2 คอลัมน์โน้ต/คอมเมนต์ */}
                  <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[13%]">โน้ตจากเซลส์</th>
                  <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[13%]">คอมเมนต์แอดมิน</th>
                  
                  {/* 🌟 รวมคิว กับ พ.ศ. */}
<th className="px-3 py-4 border-b border-slate-200 bg-slate-50 w-[9%] text-center">Estimateoder</th>

                  <th className="px-5 py-4 border-b border-slate-200 bg-slate-50 w-[9%]">ประเภทโครงการ</th>
                  <th className="px-3 py-4 border-b border-slate-200 bg-slate-50 w-[6%]">ประเภทสินค้า</th>
                  <th className="px-3 py-4 border-b border-slate-200 bg-slate-50 text-right w-[4%]">(ตร.ม.)</th>
                  <th className="px-3 py-4 border-b border-slate-200 bg-slate-50 w-[4%]">ลูกค้า</th>
                  <th className="px-3 py-4 border-b border-slate-200 bg-slate-50 text-center w-[3%]">ช่องทาง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayProjects.length === 0 ? (
  <tr><td colSpan={12} className="text-center py-10 text-slate-400 font-medium">ไม่พบข้อมูลโครงการตามเงื่อนไขที่เลือกครับ</td></tr>
) : (
                  displayProjects.map((proj, idx) => {
                    const item = Array.isArray(proj.order_items) ? proj.order_items[0] : proj.order_items;
                    const order = item?.orders;
                    const activeAccount = getActiveAccount(proj);
                    const salesName = profilesMap[order?.user_id] || 'ไม่ระบุ';
                    
                    const hasAuditLog = !!order?.audit_log;
                    const isVip = proj.is_important === true || proj.is_important === 'true' || proj.is_important === 1;
                    const isLoading = loadingId === proj.id;

                    const projectTypeName = proj.project_types?.name || '-';
                    const productCategoryName = item?.product_categories?.name || '-';

                    return (
                      <tr key={`${proj.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors group">
                        
                        <td className="px-5 py-4 align-middle">
                          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                            <CalendarDays size={14} className="text-slate-400" />
                            {formatDate(proj.created_at)}
                          </div>
                        </td>
                        
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold bg-slate-100 w-fit px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                            <User size={12} className="shrink-0" /> 
                            <span className="whitespace-normal break-words" title={salesName}>{salesName}</span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {activeAccount ? (
                            <div className="flex flex-col items-start gap-1.5">
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${activeAccount.color} shrink-0 w-fit`}>{activeAccount.role}</span>
                              <span className="text-slate-700 font-medium whitespace-normal break-words">{activeAccount.name}</span>
                            </div>
                          ) : <span className="text-slate-300">-</span>}
                        </td>

                        <td className="px-5 py-4 align-middle">
                          <div className="font-bold text-slate-800 flex items-start gap-2">
                            <button 
                              onClick={() => handleToggleVip(proj.id, isVip)}
                              disabled={isLoading}
                              className={`mt-0.5 shrink-0 transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-125'}`}
                              title={isVip ? "คลิกเพื่อเอาดาวออก" : "คลิกเพื่อติดดาวให้โปรเจกต์นี้"}
                            >
                              <Star size={18} className={isVip ? "text-rose-500 fill-rose-500" : "text-slate-300 hover:text-rose-400 hover:fill-rose-100"} />
                            </button>
                            <span className="line-clamp-2">
                              {proj.project_name || 'ไม่ได้ระบุชื่อ'}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-middle text-slate-600 text-sm">
                          {item?.note ? (
                            <div className="bg-sky-50 text-sky-700 text-xs px-2.5 py-1.5 rounded-lg border border-sky-100 line-clamp-2 font-medium" title={item.note}>
                              {item.note}
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-xs">ไม่มีโน้ตจากเซลส์</span>
                          )}
                        </td>

                        <td className="px-5 py-4 align-middle text-slate-600 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`line-clamp-2 ${proj.project_note ? 'text-slate-700 font-medium' : 'text-slate-300 italic text-xs'}`} title={proj.project_note}>
                              {proj.project_note || 'แสดงความคิดเห็น...'}
                            </span>
                            
                            <button 
                              onClick={() => setActiveEditItem({ proj, order, item })}
                              className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 shrink-0 shadow-sm"
                              title="คลิกเพื่อแก้ไขข้อมูลทั้งหมด"
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        </td>

{/* 🌟 ลำดับคิว และ พ.ศ. (ปรับให้ขยับมาใกล้กันมากขึ้นด้วย gap-1.5) */}
<td className="px-3 py-4 align-middle text-center">
  <div className="flex items-center justify-center gap-1.5">
    {proj.queue_level ? (
      <span className="bg-amber-100 text-amber-700 font-black text-xs px-2.5 py-1 rounded-md shadow-sm border border-amber-200">
        Q{proj.queue_level}
      </span>
    ) : (
      <span className="text-slate-300">-</span>
    )}
    <span className="font-bold text-slate-700 text-sm">
      {proj.project_year || '-'}
    </span>
  </div>
</td>

                        <td className="px-5 py-4 align-middle text-slate-600 text-sm font-medium">
                          {projectTypeName}
                        </td>

                        <td className="px-5 py-4 align-middle text-slate-600 text-sm font-medium">
                          {productCategoryName}
                        </td>

                        <td className="px-5 py-4 align-middle text-right">
                          <span className="font-black text-emerald-600 text-base">
                            {Number(proj.area_sqm).toLocaleString()}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-slate-600 font-medium whitespace-normal break-words">
                          {order?.customer_name || '-'}
                        </td>
                        
                        <td className="px-5 py-4 align-middle text-center">
                          {hasAuditLog ? (
                            <div className="mx-auto flex items-center justify-center gap-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md w-fit shadow-sm">
                              <Smartphone size={12} />App
                            </div>
                          ) : (
                            <div className="mx-auto flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md w-fit shadow-sm">
                              <FileText size={12} /> File
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-sm table-fixed min-w-[800px]">
              <thead className="text-slate-500 text-xs uppercase font-black tracking-widest sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-8 py-4 border-b border-slate-200 bg-slate-50 w-[10%] text-center">อันดับ</th>
                  <th className="px-8 py-4 border-b border-slate-200 bg-slate-50 w-[45%]">รายชื่อพนักงานขาย</th>
                  <th className="px-8 py-4 border-b border-slate-200 bg-slate-50 w-[20%] text-center">จำนวนงาน</th>
                  <th className="px-8 py-4 border-b border-slate-200 bg-slate-50 w-[25%] text-right">พื้นที่รวม (ตร.ม.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedSalesStats.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-slate-400">ไม่มีข้อมูลผลงานเซลส์ครับ</td></tr>
                ) : (
                  sortedSalesStats.map((stat, idx) => (
                    <tr key={`${stat.id}-${idx}`} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-8 py-5 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm shadow-sm ${idx === 0 ? 'bg-yellow-400 text-white ring-4 ring-yellow-100' : 'bg-slate-100 text-slate-500'}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black shadow-inner">
                            {stat.name.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-800 text-base">{stat.name}</span>
                        </div>
                      </td>
                      <td className={`px-8 py-5 text-center text-lg font-black ${sortBySales === 'projects' ? 'text-indigo-600' : 'text-slate-600'}`}>
                        {stat.projects} <span className="text-xs font-bold text-slate-400 ml-1">งาน</span>
                      </td>
                      <td className={`px-8 py-5 text-right text-lg font-black ${sortBySales === 'area' ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {stat.area.toLocaleString()} <span className="text-xs font-bold text-slate-400 ml-1">ตร.ม.</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <EditProjectModal 
        isOpen={!!activeEditItem} 
        data={activeEditItem} 
        onClose={() => setActiveEditItem(null)} 
        projectTypes={projectTypes} 
        productCategories={productCategories}
        onRefresh={() => {
          if (onRefresh) {
            onRefresh();
          } else {
            router.refresh();
          }
        }}
      />
    </>
  );
}