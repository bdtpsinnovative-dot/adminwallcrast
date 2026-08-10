"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown, X, Filter, Globe, Clock, CalendarDays, Loader2, Scaling } from 'lucide-react';

type Props = {
  salesList: any[];
  projectTypes: any[];
  productCategories: any[];
  teams: any[];
  customerTypes: any[];
  // 🌟 เพิ่ม Props สำหรับรับตัวเลขจำนวนโปรเจกต์แยกตามไซส์
  areaCounts?: Record<string, number>; 
};

export default function DashboardDateFilter({ salesList, projectTypes, productCategories, teams, customerTypes, areaCounts = {} }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isPending, startTransition] = useTransition();
const formatLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const now = new Date();

  const todayStr = formatLocal(now);
  const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoStr = formatLocal(thirtyDaysAgoDate);
  const ninetyDaysAgoDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgoStr = formatLocal(ninetyDaysAgoDate);
  const firstDayOfMonth = formatLocal(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastDayOfMonth = formatLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const allTimeStart = '2020-01-01';
  const allTimeEnd = '2030-12-31';

  const urlStart = searchParams.get('start') || ninetyDaysAgoStr; 
  const urlEnd = searchParams.get('end') || todayStr;
  
  const currentSales = searchParams.get('sales') || 'ALL';
  const currentProjectType = searchParams.get('projectType') || 'ALL';
  const currentProductCategory = searchParams.get('productCategory') || 'ALL';
  const currentSource = searchParams.get('source') || 'ALL';
  const currentTeam = searchParams.get('team') || 'ALL';
  const currentCustomerType = searchParams.get('customerType') || 'ALL'; 
  const currentMinArea = searchParams.get('minArea') || '';
  const currentMaxArea = searchParams.get('maxArea') || '';

  const [start, setStart] = useState(urlStart);
  const [end, setEnd] = useState(urlEnd);
  const [minAreaLocal, setMinAreaLocal] = useState(currentMinArea);
  const [maxAreaLocal, setMaxAreaLocal] = useState(currentMaxArea);
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempStart, setTempStart] = useState(urlStart);
  const [tempEnd, setTempEnd] = useState(urlEnd);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  useEffect(() => {
    if (selectedMonths.length > 0) {
      const minMonth = Math.min(...selectedMonths);
      const maxMonth = Math.max(...selectedMonths);
      
      const startD = new Date(selectedYear, minMonth, 1);
      const endD = new Date(selectedYear, maxMonth + 1, 0);
      
      setTempStart(formatLocal(startD));
      setTempEnd(formatLocal(endD));
    }
  }, [selectedMonths, selectedYear]);

  useEffect(() => {
    setStart(urlStart);
    setEnd(urlEnd);
    setMinAreaLocal(currentMinArea);
    setMaxAreaLocal(currentMaxArea);
  }, [urlStart, urlEnd, currentMinArea, currentMaxArea]);

  let activePreset = 'CUSTOM';
  if (!searchParams.get('start') && !searchParams.get('end')) {
    activePreset = '90DAYS';
  } else if (urlStart === thirtyDaysAgoStr && urlEnd === todayStr) {
    activePreset = '30DAYS';
  } else if (urlStart === firstDayOfMonth && urlEnd === lastDayOfMonth) {
    activePreset = 'THIS_MONTH';
  } else if (urlStart === allTimeStart) {
    activePreset = 'ALL_TIME';
  }

  const applyPreset = (preset: '30DAYS' | '90DAYS' | 'THIS_MONTH' | 'ALL_TIME') => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (preset === '30DAYS') {
      params.delete('start');
      params.delete('end');
    } else if (preset === '90DAYS') {
      params.set('start', ninetyDaysAgoStr);
      params.set('end', todayStr);
    } else if (preset === 'THIS_MONTH') {
      params.set('start', firstDayOfMonth);
      params.set('end', lastDayOfMonth);
    } else if (preset === 'ALL_TIME') {
      params.set('start', allTimeStart);
      params.set('end', allTimeEnd);
    }
    
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const applyFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'ALL') params.set(key, value);
    else params.delete(key);
    
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const applyDate = (type: 'start' | 'end', val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val) params.set(type, val);
    else params.delete(type);
    
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const openDateModal = () => {
    setTempStart(start);
    setTempEnd(end);
    setSelectedMonths([]);
    setShowDateModal(true);
  };

  const applyCustomDate = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (tempStart) params.set('start', tempStart); else params.delete('start');
    if (tempEnd) params.set('end', tempEnd); else params.delete('end');
    
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
    setStart(tempStart);
    setEnd(tempEnd);
    setShowDateModal(false);
  };

  const calculateDays = () => {
    if (!tempStart || !tempEnd) return 0;
    const s = new Date(tempStart);
    const e = new Date(tempEnd);
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const applyAreaFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (minAreaLocal) params.set('minArea', minAreaLocal); else params.delete('minArea');
    if (maxAreaLocal) params.set('maxArea', maxAreaLocal); else params.delete('maxArea');
    
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const applyAreaPreset = (min: string, max: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const isCurrentlyActive = currentMinArea === min && currentMaxArea === max;
    
    if (isCurrentlyActive) {
      params.delete('minArea');
      params.delete('maxArea');
      setMinAreaLocal('');
      setMaxAreaLocal('');
    } else {
      if (min) params.set('minArea', min); else params.delete('minArea');
      if (max) params.set('maxArea', max); else params.delete('maxArea');
      setMinAreaLocal(min);
      setMaxAreaLocal(max);
    }
    
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const clearAllFilters = () => {
    startTransition(() => {
      router.push('?');
    });
    setMinAreaLocal('');
    setMaxAreaLocal('');
  };

  const isFiltered = 
    searchParams.get('start') || 
    searchParams.get('end') || 
    currentSales !== 'ALL' || 
    currentTeam !== 'ALL' || 
    currentProjectType !== 'ALL' || 
    currentProductCategory !== 'ALL' || 
    currentCustomerType !== 'ALL' || 
    currentSource !== 'ALL' || 
    currentMinArea || 
    currentMaxArea;

  const areaPresets = [
    { id: 'ZERO', label: '0 ตร.ม.', min: '0', max: '0', tooltip: 'ไม่มีพื้นที่ระบุ' },
    { id: 'XS', label: 'XS', min: '1', max: '30', tooltip: 'ต่ำกว่า 30 ตร.ม.' },
    { id: 'S', label: 'S', min: '31', max: '100', tooltip: '31 - 100 ตร.ม.' },
    { id: 'M', label: 'M', min: '101', max: '300', tooltip: '101 - 300 ตร.ม.' },
    { id: 'L', label: 'L', min: '301', max: '500', tooltip: '301 - 500 ตร.ม.' },
    { id: 'XL', label: 'XL', min: '501', max: '1000', tooltip: '501 - 1000 ตร.ม.' },
    { id: 'XXL', label: 'XXL', min: '1001', max: '', tooltip: 'มากกว่า 1000 ตร.ม.' },
  ];

  return (
    <>
      {isPending && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 transform transition-all scale-100">
            <Loader2 size={48} className="text-indigo-600 animate-spin" />
            <div className="text-center space-y-1">
              <p className="text-slate-800 font-black text-xl">กำลังโหลดข้อมูล</p>
              <p className="text-slate-500 font-medium text-sm">อาจใช้เวลาสักครู่ครับ</p>
            </div>
          </div>
        </div>
      )}

      {/* --- แถวที่ 1: ตัวกรองปกติ --- */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter size={16} className="text-slate-400 hidden lg:block mr-1" />

        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner">
          <button 
            onClick={() => applyPreset('30DAYS')}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activePreset === '30DAYS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} disabled:opacity-50`}
          >
            <Clock size={14} /> 30 วัน
          </button>
          <button 
            onClick={() => applyPreset('90DAYS')}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activePreset === '90DAYS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} disabled:opacity-50`}
          >
            <Clock size={14} /> 90 วัน
          </button>
          <button 
            onClick={() => applyPreset('THIS_MONTH')}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activePreset === 'THIS_MONTH' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} disabled:opacity-50`}
          >
            <CalendarDays size={14} /> เดือนนี้
          </button>
          <button 
            onClick={() => applyPreset('ALL_TIME')}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activePreset === 'ALL_TIME' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} disabled:opacity-50`}
          >
            <Globe size={14} /> ทั้งหมด
          </button>
        </div>

        <div 
          onClick={openDateModal}
          className={`flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5 shadow-sm transition-colors cursor-pointer ${activePreset === 'CUSTOM' ? 'border-indigo-400 ring-1 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300'} ${isPending ? 'opacity-50 pointer-events-none' : ''}`} 
          title="หรือระบุช่วงเวลาที่ต้องการเอง"
        >
          <Calendar size={14} className={activePreset === 'CUSTOM' ? "text-indigo-600" : "text-slate-400"} />
          <span className="text-xs font-semibold text-slate-700">{start}</span>
          <span className="text-slate-400 text-xs">-</span>
          <span className="text-xs font-semibold text-slate-700">{end}</span>
        </div>

        <div className="relative">
          <select 
            disabled={isPending}
            className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm disabled:opacity-50
              ${currentSource !== 'ALL' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300'}`}
            value={currentSource} 
            onChange={(e) => applyFilter('source', e.target.value)}
          >
            <option value="ALL">🌐 ที่มา: ทั้งหมด</option>
            <option value="APP">📱 ผ่านแอปฯ</option>
            <option value="IMPORT">📁 นำเข้าไฟล์</option>
          </select>
          <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select 
            disabled={isPending}
            className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm disabled:opacity-50
              ${currentCustomerType !== 'ALL' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-slate-200 bg-white text-slate-700 hover:border-pink-300'}`}
            value={currentCustomerType} 
            onChange={(e) => applyFilter('customerType', e.target.value)}
          >
            <option value="ALL">🤝 ลูกค้า: ทั้งหมด</option>
            {customerTypes?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select 
            disabled={isPending}
            className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm disabled:opacity-50
              ${currentSales !== 'ALL' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'}`}
            value={currentSales} 
            onChange={(e) => applyFilter('sales', e.target.value)}
          >
            <option value="ALL">👤 เซลส์: ทั้งหมด</option>
            {salesList?.map((s: any) => <option key={s.id} value={s.id}>{s.full_name || 'ไม่ระบุชื่อ'}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            disabled={isPending}
            className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm disabled:opacity-50
              ${currentTeam !== 'ALL' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300'}`}
            value={currentTeam}
            onChange={(e) => applyFilter('team', e.target.value)}
          >
            <option value="ALL">🏠 ทีม: ทั้งหมด</option>
            {teams?.map((t: any) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select 
            disabled={isPending}
            className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm disabled:opacity-50
              ${currentProjectType !== 'ALL' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'}`}
            value={currentProjectType} 
            onChange={(e) => applyFilter('projectType', e.target.value)}
          >
            <option value="ALL">🏢 ประเภทงาน: ทั้งหมด</option>
            {projectTypes?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select 
            disabled={isPending}
            className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-xs font-medium outline-none transition-colors cursor-pointer shadow-sm disabled:opacity-50
              ${currentProductCategory !== 'ALL' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'}`}
            value={currentProductCategory} 
            onChange={(e) => applyFilter('productCategory', e.target.value)}
          >
            <option value="ALL">🛍 สินค้า: ทั้งหมด</option>
            {productCategories?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>

        {isFiltered && (
          <button 
            onClick={clearAllFilters}
            disabled={isPending}
            className="ml-1 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 p-1.5 rounded-lg transition-colors border border-rose-100 shadow-sm flex items-center gap-1 text-[11px] font-bold disabled:opacity-50"
            title="ล้างตัวกรองทั้งหมด"
          >
            <X size={14} strokeWidth={2.5} /> ล้าง
          </button>
        )}
      </div>

      {/* --- แถวที่ 2: ฟิลเตอร์ขนาดพื้นที่ (เพิ่ม Badge ตัวเลข) --- */}
      <div className="flex flex-wrap items-center gap-3 w-full">
      </div>

      {/* --- Modal เลือกวันที่ --- */}
      {showDateModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-xl shadow-xl w-[320px] transform transition-all scale-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">เลือกช่วงเวลา</h3>
              <button onClick={() => setShowDateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex items-center justify-between mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
              <button 
                onClick={() => setSelectedYear(y => y - 1)}
                className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"
              >
                <ChevronDown size={16} className="rotate-90" />
              </button>
              <span className="font-bold text-slate-700 text-sm">ปี ค.ศ. {selectedYear}</span>
              <button 
                onClick={() => setSelectedYear(y => y + 1)}
                className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"
              >
                <ChevronDown size={16} className="-rotate-90" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'].map((m, i) => (
                <button
                  key={m}
                  onClick={() => {
                    setSelectedMonths(prev => 
                      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                    );
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-all ${selectedMonths.includes(i) ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-4 mb-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">วันเริ่มต้น (ปรับเอง)</label>
                <input 
                  type="date" 
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-shadow"
                  value={tempStart}
                  onChange={(e) => {
                    setTempStart(e.target.value);
                    setSelectedMonths([]);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">วันสิ้นสุด (ปรับเอง)</label>
                <input 
                  type="date" 
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-shadow"
                  value={tempEnd}
                  onChange={(e) => {
                    setTempEnd(e.target.value);
                    setSelectedMonths([]);
                  }}
                />
              </div>
            </div>

            <div className="bg-indigo-50 text-indigo-700 text-sm font-semibold px-3 py-2.5 rounded-lg mb-6 text-center border border-indigo-100 flex items-center justify-center gap-2">
              <CalendarDays size={16} />
              จำนวนที่เลือก: {calculateDays()} วัน
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowDateModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                onClick={applyCustomDate}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}