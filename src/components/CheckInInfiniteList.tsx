'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, FileText, Smartphone, Building2, User, Calendar, Clock, Users, Map, Image as ImageIcon, Loader2 } from 'lucide-react';
import EditCheckInModal from '@/components/EditCheckInModal';
import ExpandableNote from '@/components/ExpandableNote';
import CheckInMap from '@/components/CheckInMap';
import ImageGallery from '@/components/ImageGallery';

interface CheckInInfiniteListProps {
  ordersList: any[];
  userId: string;
  categories: any[];
}

export default function CheckInInfiniteList({ ordersList, userId, categories }: CheckInInfiniteListProps) {
  const [visibleCount, setVisibleCount] = useState(10);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // รีเซ็ตตอนเปลี่ยน filter
    setVisibleCount(10);
  }, [ordersList]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((prev) => Math.min(prev + 10, ordersList.length));
      }
    }, {
      rootMargin: '200px', // โหลดล่วงหน้าตอนเหลือ 200px ก่อนถึงขอบล่าง
    });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [ordersList.length]);

  const visibleOrders = ordersList.slice(0, visibleCount);
  const hasMore = visibleCount < ordersList.length;

  if (ordersList.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-16 text-center flex flex-col items-center">
        <div className="w-20 h-20 bg-slate-50 rounded-md border border-slate-100 flex items-center justify-center mb-4">
          <MapPin size={40} className="text-slate-300" />
        </div>
        <p className="text-lg font-medium text-slate-500">ไม่พบข้อมูลประวัติ</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {visibleOrders.map((order, orderIdx) => (
        <div key={order.orderId} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all relative">
          
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 ${order.isCsv ? 'bg-slate-500' : 'bg-slate-700'}`}>
                  {order.isCsv ? <FileText size={12}/> : <Smartphone size={12}/>}
                  ORDER #{order.orderId.substring(0, 8).toUpperCase()}
                </span>
                <span className="text-sm font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded flex items-center gap-1.5">
                  <Building2 size={14} className="text-slate-400" /> {order.companyName}
                </span>
                {userId === 'all' && (
                  <span className="text-sm font-semibold text-slate-600 border border-slate-200 bg-white px-2 py-0.5 rounded flex items-center gap-1.5">
                    <User size={14} className="text-slate-400"/> {order.salesName}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1"><User size={14} className="text-slate-400"/> {order.customerName}</span>
                <span className="flex items-center gap-1">โทร: {order.phone}</span>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end text-xs font-semibold text-slate-500 gap-1 shrink-0">
              <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-400"/> {order.date}</span>
              <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400"/> {order.time}</span>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-10">
            {order.projects.map((proj: any, pIdx: number) => {
              const hasStakeholders = proj.stakeholders.devAcc || proj.stakeholders.devCont || 
                                      proj.stakeholders.archAcc || proj.stakeholders.archCont || 
                                      proj.stakeholders.intAcc || proj.stakeholders.intCont || 
                                      proj.stakeholders.contAcc || proj.stakeholders.contCont;

              return (
                <div key={proj.id} className={`grid grid-cols-1 xl:grid-cols-12 gap-8 ${pIdx > 0 ? 'pt-8 border-t border-slate-100' : ''}`}>
                  
                  <div className="col-span-1 xl:col-span-5 flex flex-col justify-start">
                    <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 bg-slate-100 border border-slate-200 rounded text-xs font-semibold text-slate-600 flex items-center justify-center mt-0.5 shrink-0">
                          {pIdx + 1}
                        </span>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-800 leading-tight">{proj.projectName}</h3>
                          <div className="text-xs text-slate-500 mt-1 flex gap-3">
                            <span className="flex items-center gap-1"><span className="text-slate-700 font-medium">{proj.categoryName}</span></span>
                            <span className="flex items-center gap-1">ประเภท: <span className="text-slate-700 font-medium">{proj.projectType}</span></span>
                          </div>
                        </div>
                      </div>
                      
                      {!order.isCsv && userId !== 'all' && (
                        <EditCheckInModal 
                          orderItemId={proj.orderItemId}
                          projectId={proj.projectId}
                          currentCategoryId={proj.categoryId}
                          currentArea={proj.area}
                          userId={userId}
                          categories={categories}
                        />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-slate-600 font-medium mb-5">
                      <Map size={16} className="text-slate-400" /> 
                      พื้นที่: <span className="font-semibold text-slate-800">{Number(proj.area).toLocaleString()} ตร.ม.</span>
                    </div>

                    {hasStakeholders && (
                      <div className="mb-5 bg-slate-50 p-4 rounded-md border border-slate-200">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                          <Users size={14} className="text-slate-400" /> ผู้เกี่ยวข้อง
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {(proj.stakeholders.devAcc || proj.stakeholders.devCont) && (
                            <div className="flex flex-col bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                              <span className="text-[9px] text-slate-400 font-bold uppercase">Developer</span>
                              {proj.stakeholders.devCont && <span className="text-xs text-slate-700 font-bold truncate" title={proj.stakeholders.devCont}>{proj.stakeholders.devCont}</span>}
                              {proj.stakeholders.devAcc && <span className="text-[10px] text-slate-500 truncate">{proj.stakeholders.devAcc}</span>}
                            </div>
                          )}
                          {(proj.stakeholders.archAcc || proj.stakeholders.archCont) && (
                            <div className="flex flex-col bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                              <span className="text-[9px] text-slate-400 font-bold uppercase">Architect</span>
                              {proj.stakeholders.archCont && <span className="text-xs text-slate-700 font-bold truncate" title={proj.stakeholders.archCont}>{proj.stakeholders.archCont}</span>}
                              {proj.stakeholders.archAcc && <span className="text-[10px] text-slate-500 truncate">{proj.stakeholders.archAcc}</span>}
                            </div>
                          )}
                          {(proj.stakeholders.intAcc || proj.stakeholders.intCont) && (
                            <div className="flex flex-col bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                              <span className="text-[9px] text-slate-400 font-bold uppercase">Interior</span>
                              {proj.stakeholders.intCont && <span className="text-xs text-slate-700 font-bold truncate" title={proj.stakeholders.intCont}>{proj.stakeholders.intCont}</span>}
                              {proj.stakeholders.intAcc && <span className="text-[10px] text-slate-500 truncate">{proj.stakeholders.intAcc}</span>}
                            </div>
                          )}
                          {(proj.stakeholders.contAcc || proj.stakeholders.contCont) && (
                            <div className="flex flex-col bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                              <span className="text-[9px] text-slate-400 font-bold uppercase">Contractor</span>
                              {proj.stakeholders.contCont && <span className="text-xs text-slate-700 font-bold truncate" title={proj.stakeholders.contCont}>{proj.stakeholders.contCont}</span>}
                              {proj.stakeholders.contAcc && <span className="text-[10px] text-slate-500 truncate">{proj.stakeholders.contAcc}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {proj.note && proj.note !== '-' && (
                      <ExpandableNote note={proj.note} />
                    )}

                    <div className="mt-auto pt-3 flex flex-col gap-2">
                      {proj.lat && proj.lng ? (
                        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400" /> {proj.lat.toFixed(5)}, {proj.lng.toFixed(5)}
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">ไม่มีพิกัดตำแหน่ง</span>
                      )}
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Device: {proj.device}</span>
                    </div>
                  </div>

                  <div className="col-span-1 xl:col-span-3 flex flex-col">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5 shrink-0">
                      <Map size={14} /> ตำแหน่งที่ตั้ง
                    </div>
                    <div className="flex-1 min-h-[220px] flex flex-col">
                      <CheckInMap lat={proj.lat} lng={proj.lng} isCsv={order.isCsv} />
                    </div>
                  </div>

                  <div className="col-span-1 xl:col-span-4 flex flex-col overflow-hidden">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                      <ImageIcon size={14} /> รูปภาพ ({proj.images.length})
                    </div>
                    <div className="flex-1 min-h-[220px] bg-slate-50 rounded-md border border-slate-200 overflow-hidden">
                      <ImageGallery images={proj.images} />
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      ))}
      
      {/* Element สำหรับเช็คการเลื่อนลง (Intersection Observer Target) */}
      {hasMore && (
        <div ref={loadMoreRef} className="py-8 flex justify-center items-center text-slate-400">
          <Loader2 className="animate-spin" size={24} />
          <span className="ml-2 text-sm font-medium">กำลังโหลดข้อมูลเพิ่ม...</span>
        </div>
      )}
    </div>
  );
}
