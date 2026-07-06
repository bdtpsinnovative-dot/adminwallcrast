// src/components/ExportExcelButton.tsx
'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { FileDown, X, Download } from 'lucide-react';

interface ExportButtonProps {
  ordersData: any[];
}

export default function ExportExcelButton({ ordersData }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // รูปแบบแรกที่ยังไม่ได้แก้ไขอะไร
  const handleExportOriginal = () => {
    const rows = ordersData.flatMap((order) => {
      return order.projects.map((proj: any) => {
        const fmtStakeholder = (company: string, contact: string) => {
          if (company && contact) return `${company} (${contact})`;
          return company || contact || '';
        };

        const availableContacts = [
          proj.stakeholders.devCont,
          proj.stakeholders.archCont,
          proj.stakeholders.intCont,
          proj.stakeholders.contCont
        ].filter(Boolean);

        const randomPhone = availableContacts.length > 0 
          ? availableContacts[Math.floor(Math.random() * availableContacts.length)] 
          : (order.phone || '');

        const sourceName = order.source || (order.isCsv ? 'CSV Import' : 'Mobile App');

        return {
          'Project name': proj.projectName || '',
          'Contact': order.customerName || '',
          'Phone': randomPhone,
          '*Pipeline': order.teamName || '', 
          '*Project Type': proj.projectType || '', 
          'Closing Potential': proj.interestLevel || order.interestLevel || '', 
          'Salesperson': order.salesName || '',
          '*Product Group': proj.categoryName || '', 
          '*Source': sourceName,
          'Architecture': fmtStakeholder(proj.stakeholders.archAcc, proj.stakeholders.archCont),
          'Contractor': fmtStakeholder(proj.stakeholders.contAcc, proj.stakeholders.contCont),
          'Landscape': '', 
          'Interior': fmtStakeholder(proj.stakeholders.intAcc, proj.stakeholders.intCont),
          'Developer': fmtStakeholder(proj.stakeholders.devAcc, proj.stakeholders.devCont),
          'Unit / Project': Number(proj.area) || 0, 
          'Note :': proj.note || '', 
        };
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Project History');

    const maxProps = [
      { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
      { wch: 15 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
      { wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 30 },
    ];
    worksheet['!cols'] = maxProps;

    const fileName = `Project_Report_Original_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    setIsOpen(false);
  };

  // รูปแบบ Odoo ที่ปรับแต่งล่าสุด
  const handleExportOdoo = () => {
    const rows = ordersData.flatMap((order) => {
      return order.projects.map((proj: any) => {
        const fmtStakeholder = (company: string, contact: string) => {
          if (company && contact) return `${company} (${contact})`;
          return company || contact || '';
        };

        const mapProjectType = (type: string, area: number) => {
          if (!type || type === '-') return '';
          const t = type.trim();
          
          if (t.includes('Private Residence') || t.includes('Private Resident')) return 'Private Residence';
          if (t.includes('Hotel')) return 'Hotel';
          if (t.includes('Shopping Mall')) return 'Community Mall';
          if (t.includes('Office Building')) return 'Office';
          if (t.includes('Hospital')) return 'Hospital';
          if (t.includes('อื่นๆ') || t.includes('Other')) return 'Other';
          if (t.includes('Shop&Restaurant') || t.includes('Shop & Restaurant')) return 'Commercial';
          if (t.includes('Resort/Villa') || t.includes('Resort / Villa')) return 'Resort/Villa';
          if (t.includes('Housing Estate')) return 'Housing Estate';
          if (t.includes('Condominium')) {
            return area >= 500 ? 'High Rise' : 'Low Rise';
          }
          
          const cleaned = t.replace(/\s*\(.*?\)/g, '');
          return cleaned === '-' ? '' : cleaned;
        };

        const availableContacts = [
          proj.stakeholders.devCont,
          proj.stakeholders.archCont,
          proj.stakeholders.intCont,
          proj.stakeholders.contCont
        ].filter(Boolean);

        const randomPhone = availableContacts.length > 0 
          ? availableContacts[Math.floor(Math.random() * availableContacts.length)] 
          : (order.phone || '');

        const productGroup = proj.categoryName || '';
        let pipeline = order.teamName || '';
        
        if (pipeline.includes('Team-Project')) {
          const pg = productGroup.toLowerCase();
          if (pg.includes('flooring') || pg.includes('door') || pg.includes('decting') || pg.includes('decking')) {
            pipeline = 'W-Project';
          } else if (pg.includes('wallcraft')) {
            pipeline = 'Wall-Project';
          } else if (pg.includes('furniture')) {
            pipeline = 'Fur-Project';
          }
        }

        return {
          'Project name': proj.projectName || '',
          'Contact': order.customerName || '',
          'Phone': randomPhone,
          'Pipeline': pipeline, 
          'Project Type': mapProjectType(proj.projectType, Number(proj.area) || 0), 
          'Salesperson': order.salesEmail || order.salesName || '',
          'Product Group': productGroup, 
          'Architecture': fmtStakeholder(proj.stakeholders.archAcc, proj.stakeholders.archCont),
          'Contractor': fmtStakeholder(proj.stakeholders.contAcc, proj.stakeholders.contCont),
          'Landscape': '', 
          'Interior': fmtStakeholder(proj.stakeholders.intAcc, proj.stakeholders.intCont),
          'Developer': fmtStakeholder(proj.stakeholders.devAcc, proj.stakeholders.devCont),
          'Unit / Project': Number(proj.area) || 0, 
          'Note :': proj.note || '', 
        };
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Project History Odoo');

    const maxProps = [
      { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 30 },
      { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
      { wch: 15 }, { wch: 30 },
    ];
    worksheet['!cols'] = maxProps;

    const fileName = `Project_Report_Odoo_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    setIsOpen(false);
  };

  if (!ordersData || ordersData.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-sm border border-emerald-500 hover:scale-[1.02] shrink-0"
      >
        <FileDown size={16} />
        โหลดข้อมูล
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileDown size={20} className="text-emerald-600" />
                ดาวน์โหลดข้อมูล
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 p-1.5 rounded-lg transition-colors border border-slate-200 shadow-sm"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <button
                onClick={handleExportOriginal}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left"
              >
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                  <FileDown size={24} />
                </div>
                <div>
                  <div className="font-bold text-emerald-800 text-sm">ดาวน์โหลด Excel</div>
                  <div className="text-xs text-emerald-600/70 mt-0.5">โหลดข้อมูลด้วยรูปแบบดั้งเดิม</div>
                </div>
              </button>
              
              <button
                onClick={handleExportOdoo}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group text-left"
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  <Download size={24} />
                </div>
                <div>
                  <div className="font-bold text-indigo-800 text-sm">ดาวน์โหลดรูปแบบ โอดูล (Odoo)</div>
                  <div className="text-xs text-indigo-600/70 mt-0.5">รูปแบบที่ปรับแต่งคอลัมน์ล่าสุด</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}