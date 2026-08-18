"use client";

import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as LineTooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LabelList
} from 'recharts';

const PROJECT_TYPE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#14b8a6', '#f43f5e', '#6366f1', '#84cc16', '#64748b']; 
const INTEREST_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#94a3b8', '#cbd5e1']; 

interface DashboardChartsProps {
  lineData?: { date: string; count: number }[];
  pieData?: { name: string; value: number }[];
  barData?: { name: string; projects: number; area: number }[];
  sourceData?: { name: string; value: number }[];
  projectTypeData?: { name: string; value: number }[]; 
  interestData?: { name: string; value: number }[];
  stakeholderData?: { name: string; count: number }[];
}

export default function DashboardCharts({ 
  lineData = [], 
  pieData = [], 
  barData = [], 
  sourceData = [], 
  projectTypeData = [], 
  interestData = [], 
  stakeholderData = [] 
}: DashboardChartsProps) {

  // 🟢 อัปเดตการกรองข้อมูล: ดักถอนรากถอนโคนคำว่า "ไม่ระบุประเภท" และค่าว่างทุกรูปแบบ
  const filteredProjectTypeData = projectTypeData.filter((item) => {
    if (!item || !item.name) return false;
    const name = item.name.trim();
    return (
      name !== "ไม่ระบุประเภท" && 
      name !== "ไม่ระบุ" && 
      name !== "Unspecified" && 
      name !== "Unknown" && 
      name !== ""
    );
  });

  return (
    <div className="flex flex-col gap-6 mb-8">
      
      {/* --- แถวที่ 1: กราฟเทรนด์ และ ประเภทโปรเจกต์ --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200 min-w-0">
          <h3 className="font-bold text-slate-800 mb-1">เทรนด์การสร้างโปรเจกต์รายวัน (Daily Activity)</h3>
          <div className="h-72 w-full min-w-0"> {/* 👈 ฟิกซ์ขนาดความสูง 72 ไว้คุม ResponsiveContainer */}
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={lineData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <LineTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="count" name="จำนวนโปรเจกต์" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 🟢 ใช้ข้อมูลที่ผ่านการกรองก้อน "ไม่ระบุประเภท" ออกเรียบร้อยแล้ว */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 min-w-0">
          <h3 className="font-bold text-slate-800 mb-1">สัดส่วนประเภทโปรเจกต์ (Project Types)</h3>
          <p className="text-xs text-slate-500 mb-4">จัดลำดับประเภทโครงการที่พบมากที่สุด (ไม่รวมไม่ระบุประเภท)</p>
          <div className="h-72 w-full min-w-0"> {/* 👈 ฟิกซ์ขนาดความสูง 72 ไว้คุม ResponsiveContainer */}
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart 
                data={filteredProjectTypeData} 
                layout="vertical" 
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} 
                  width={110} 
                />
                <LineTooltip 
                  cursor={{fill: '#f8fafc'}} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                />
                <Bar dataKey="value" name="จำนวน" radius={[0, 4, 4, 0]} barSize={18}>
                  {filteredProjectTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PROJECT_TYPE_COLORS[index % PROJECT_TYPE_COLORS.length]} />
                  ))}
                  <LabelList dataKey="value" position="right" style={{ fontSize: '10px', fill: '#64748b', fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- แถวที่ 2: เจาะลึกความสนใจ และ ผู้เกี่ยวข้อง --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 min-w-0">
          <h3 className="font-bold text-slate-800 mb-1">ระดับความสนใจของลูกค้า (Interest Level)</h3>
          <div className="h-64 w-full min-w-0"> {/* 👈 ฟิกซ์ขนาดความสูง 64 ไว้คุม ResponsiveContainer */}
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={interestData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} width={140} />
                <LineTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" name="จำนวนโปรเจกต์" radius={[0, 4, 4, 0]} barSize={24}>
                  {interestData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={INTEREST_COLORS[index % INTEREST_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 min-w-0">
          <h3 className="font-bold text-slate-800 mb-1">เครือข่ายผู้เกี่ยวข้อง (Project Stakeholders)</h3>
          <div className="h-64 w-full min-w-0"> {/* 👈 ฟิกซ์ขนาดความสูง 64 ไว้คุม ResponsiveContainer */}
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={stakeholderData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <LineTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="count" name="จำนวนที่พบในระบบ" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- แถวที่ 3: กราฟแท่งผลงานรายบุคคล --- */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 min-w-0">
        <h3 className="font-bold text-slate-800 mb-1">วิเคราะห์ประสิทธิภาพรายบุคคล (Individual Performance)</h3>
        <p className="text-xs text-slate-500 mb-4">แสดงผลงานของเซลส์ทุกคน (เลื่อนซ้าย-ขวาเพื่อดูทั้งหมด)</p>
        
        <div className="w-full overflow-x-auto pb-4 custom-scrollbar min-w-0">
          {/* 🛠️ ฟิกซ์ความสูง h-[450px] ตรงตัวกล่อง div ที่ครอบ ResponsiveContainer ชั้นนี้เลยครับ ชัวร์สุด */}
          <div className="h-[450px]" style={{ minWidth: `${Math.max(barData.length * 80, 1000)}px` }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={barData} margin={{ top: 30, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  tick={{ fontSize: 12, fill: '#475569', fontStyle: 'italic', fontWeight: 500 }} 
                  axisLine={false} 
                  tickLine={false} 
                  height={120} 
                  interval={0} 
                />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <LineTooltip 
                  cursor={{fill: '#f8fafc'}} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                />
                <Bar dataKey="projects" name="จำนวนโปรเจกต์ (งาน)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32}>
                  <LabelList 
                    dataKey="projects" 
                    position="top" 
                    offset={5} 
                    style={{ fontSize: '12px', fill: '#3b82f6', fontWeight: '800' }} 
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}