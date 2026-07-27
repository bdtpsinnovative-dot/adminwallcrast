'use client';

import React, { useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useRouter } from 'next/navigation';
import { Building2, Users2, AlertCircle, Search, X, Calendar, User, Pointer } from 'lucide-react';

interface Props {
  data: any[];
  salesKeys?: string[];
}

export default function CompanyCandlestickChart({ data, salesKeys = [] }: Props) {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const dragState = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    isDragging: false,
    dragEndTime: 0,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [displayLimit, setDisplayLimit] = useState(50);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#f97316', '#14b8a6', '#84cc16'];

  const rawData = data?.filter(Boolean) || [];
  
  const allFilteredData = rawData.filter(item => 
    item.name?.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const chartData = allFilteredData.slice(0, displayLimit);

  const dynamicWidth = Math.max(1600, 150 + (chartData.length * 65));

  if (!rawData || rawData.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center justify-center w-full mb-8 h-[200px]">
        <AlertCircle className="text-slate-300 mb-2" size={32} />
        <h3 className="font-bold text-slate-500">ยังไม่มีข้อมูลสถิติการพบซ้ำ</h3>
      </div>
    );
  }

  // --- ฟังก์ชันการลากหน้าจอ ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    dragState.current.isDown = true;
    dragState.current.isDragging = false; 
    dragState.current.startX = e.pageX - scrollContainerRef.current.offsetLeft;
    dragState.current.scrollLeft = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current.isDown || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - dragState.current.startX); 
    if (Math.abs(walk) > 3) dragState.current.isDragging = true; 
    scrollContainerRef.current.scrollLeft = dragState.current.scrollLeft - (walk * 1.5);
  };

  const handleMouseUp = () => { 
    dragState.current.isDown = false; 
    if (dragState.current.isDragging) dragState.current.dragEndTime = Date.now();
    setTimeout(() => { dragState.current.isDragging = false; }, 100);
  };

  const handleMouseLeave = () => { 
    dragState.current.isDown = false; 
    dragState.current.isDragging = false;
  };

  const handleBarClick = (companyId: string) => {
    const timeSinceLastDrag = Date.now() - dragState.current.dragEndTime;
    if (dragState.current.isDragging || timeSinceLastDrag < 200) return; 
    if (!companyId) return; 
    
    // 🌟 ใช้ window.open พ่วงด้วย '_blank' เพื่อสั่งให้เบราว์เซอร์เปิดแท็บใหม่
    window.open(`/dashboard/companies/${companyId}`, '_blank');
  };

  // ดึงประวัติแยกรายคน 
  const getGroupedVisits = (companyItem: any) => {
    const groups: { salesName: string; count: number; color: string; dates: string[] }[] = [];
    if (companyItem && companyItem.id) {
      const mockDates = ['18 มิ.ย.', '12 มิ.ย.', '05 มิ.ย.', '28 พ.ค.', '10 พ.ค.', '02 พ.ค.'];
      let visitIndex = 0;
      
      salesKeys.forEach((salesName, sIdx) => {
        const visitCount = companyItem[salesName] || 0;
        if (visitCount > 0) {
          const dates = [];
          for (let i = 0; i < visitCount; i++) {
            dates.push(mockDates[visitIndex % mockDates.length]);
            visitIndex++;
          }
          groups.push({
            salesName,
            count: visitCount,
            color: COLORS[sIdx % COLORS.length],
            dates
          });
        }
      });
    }
    return groups.sort((a, b) => b.count - a.count);
  };

  // 🌟 กล่อง Tooltip โฉมใหม่: ใช้เวทมนตร์หยุดเวลา (Stop Propagation) 🌟
  const CustomTooltip = ({ active, payload }: any) => {
    // ซ่อนกล่องถ้านายกำลังลากกราฟอยู่
    if (dragState.current.isDown) return null;

    if (active && payload && payload.length) {
      const itemData = payload[0].payload;
      const groupedLogs = getGroupedVisits(itemData);

      return (
        <div 
          className="bg-white p-4 rounded-xl shadow-2xl border border-slate-200 min-w-[280px] max-w-[340px] select-none z-50 relative"
          // 🟢 พลังแก้บั๊กอยู่ตรงนี้: เมื่อเมาส์ขยับในกล่อง สั่งห้ามกราฟหลังกล่องขยับตามเด็ดขาด!
          onMouseMove={(e) => e.stopPropagation()}
          onMouseEnter={(e) => e.stopPropagation()}
          onMouseLeave={(e) => e.stopPropagation()}
          onWheelCapture={(e) => e.stopPropagation()}
        >
          <p className="font-black text-slate-800 text-sm flex items-center gap-1.5 mb-1.5 border-b border-slate-100 pb-2">
            <Building2 size={16} className="text-indigo-600" /> {itemData.name}
          </p>
          
          <div className="text-xs font-bold flex justify-between items-center text-slate-500 mb-3">
            <span>รวมการเข้าพบทั้งหมด:</span>
            <span className="text-indigo-600 text-sm font-black bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              {itemData.count} ครั้ง
            </span>
          </div>
          
          {/* สามารถไถสกอร์เมาส์ขึ้นลงในนี้ได้เลยครับ */}
          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
            {groupedLogs.map((group, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: group.color }}></span>
                    <User size={12} className="text-slate-400" /> {group.salesName}
                  </span>
                  <span className="text-[10px] font-black text-slate-500">
                    {group.count} ครั้ง
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-1.5 pl-4">
                  {group.dates.map((dateStr, i) => (
                    <span key={i} className="text-[9px] font-bold text-slate-600 bg-white border border-slate-200/80 px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                      <Calendar size={9} className="text-slate-400" /> {dateStr}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p 
            className="text-[10px] text-indigo-500 mt-3 text-center font-bold bg-indigo-50/50 py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer hover:bg-indigo-100 transition-colors"
            onClick={() => handleBarClick(itemData.id)}
          >
            <Pointer size={12} /> คลิกที่แท่งกราฟเพื่อเจาะลึกข้อมูลบริษัท
          </p>
        </div>
      );
    }
    return null;
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, clientWidth, scrollWidth } = scrollContainerRef.current;
    if (scrollLeft + clientWidth >= scrollWidth - 350) {
      if (displayLimit < allFilteredData.length) {
        setDisplayLimit(prev => Math.min(allFilteredData.length, prev + 50));
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 flex flex-col w-full mb-8">
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 border-b border-slate-100 pb-5">
        <div className="max-w-2xl">
          <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
            <Users2 size={20} className="text-indigo-600" /> 
            อันดับความถี่การเข้าพบซ้ำรายบริษัท (B2B Engagement Frequency)
          </h3>
          <p className="text-slate-500 text-sm font-medium mt-0.5">
            💡 ลากเลื่อนขวาเพื่อดูบริษัทเพิ่มเติม (โหลดเพิ่มให้อัตโนมัติเมื่อเลื่อนสุด) หรือเอาเมาส์ชี้ดูรายละเอียด
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span>แสดง {chartData.length.toLocaleString()} จาก {allFilteredData.length.toLocaleString()} บริษัท</span>
            {displayLimit < allFilteredData.length && (
              <button
                onClick={() => setDisplayLimit(allFilteredData.length)}
                className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 underline ml-1"
              >
                แสดงทั้งหมด
              </button>
            )}
          </div>

          <div className="w-full sm:w-64 relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="ค้นหาชื่อบริษัท..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setDisplayLimit(50);
              }}
              className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 transition-all shadow-inner"
            />
            {searchTerm && (
              <button onClick={() => { setSearchTerm(''); setDisplayLimit(50); }} className="absolute inset-y-0 right-2 flex items-center px-1 text-slate-400 hover:text-slate-600">
                <X size={16} className="bg-slate-200/60 hover:bg-slate-200 p-0.5 rounded-full" />
              </button>
            )}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="w-full h-[350px] flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          <AlertCircle className="text-slate-400 mb-2" size={28} />
          <p className="font-bold text-slate-600 text-sm">ไม่พบข้อมูลบริษัทที่ค้นหา "{searchTerm}"</p>
        </div>
      ) : (
        <div 
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onScroll={handleScroll}
          className="w-full h-[410px] overflow-x-auto select-none cursor-grab active:cursor-grabbing focus:outline-none relative"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none', outline: 'none' }}
        >
          <style dangerouslySetInnerHTML={{__html: `div::-webkit-scrollbar { display: none !important; }`}} />
          <div style={{ width: `${dynamicWidth}px` }} className="h-full">
            <BarChart width={dynamicWidth} height={390} data={chartData} margin={{ top: 25, right: 30, left: 10, bottom: 45 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} interval={0} angle={-45} textAnchor="end" height={120} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} unit=" ครั้ง" />
              
              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{ fill: '#f8fafc' }} 
                wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }} 
              />
              
              {salesKeys.map((salesName, index) => (
                <Bar 
                  key={salesName}
                  dataKey={salesName} 
                  stackId="a" 
                  barSize={32}
                  fill={COLORS[index % COLORS.length]} 
                  cursor="pointer"
                  className="transition-all duration-300 hover:brightness-110 focus:outline-none"
                  onClick={(entry: any) => handleBarClick(entry.id)}
                />
              ))}
            </BarChart>
          </div>
        </div>
      )}

      {displayLimit < allFilteredData.length && (
        <div className="mt-3 flex items-center justify-between bg-indigo-50/60 border border-indigo-100 px-4 py-2 rounded-xl text-xs font-semibold text-indigo-700">
          <span>แสดง {chartData.length} จาก {allFilteredData.length} บริษัท (เลื่อนขวาเพื่อดึงข้อมูลเพิ่มอัตโนมัติ)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setDisplayLimit(prev => Math.min(allFilteredData.length, prev + 50))}
              className="bg-white hover:bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg text-indigo-700 font-bold transition shadow-sm"
            >
              + โหลดเพิ่ม 50 บริษัท
            </button>
            <button
              onClick={() => setDisplayLimit(allFilteredData.length)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg font-bold transition shadow-sm"
            >
              แสดงทั้งหมด ({allFilteredData.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}