"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search, RefreshCw, Edit3, Save, X, Trash2, RotateCcw, FileSpreadsheet, Calendar, AlertTriangle, Filter, Download
} from "lucide-react";
import * as XLSX from "xlsx";

// --- ฟังก์ชันจัดกลุ่มสีสำหรับข้อมูลที่ซ้ำกัน ---
const getDuplicateGroupColor = (row: any, allRows: any[]) => {
  const colors = [
    "bg-rose-50 hover:bg-rose-100/80 border-rose-200 text-rose-950",
    "bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-amber-950",
    "bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200 text-emerald-950",
    "bg-indigo-50 hover:bg-indigo-100/80 border-indigo-200 text-indigo-950",
    "bg-violet-50 hover:bg-violet-100/80 border-violet-200 text-violet-950",
    "bg-sky-50 hover:bg-sky-100/80 border-sky-200 text-sky-950",
    "bg-teal-50 hover:bg-teal-100/80 border-teal-200 text-teal-950",
    "bg-pink-50 hover:bg-pink-100/80 border-pink-200 text-pink-950"
  ];
  
  const duplicates = allRows.filter((rowB) => {
    const timeA = new Date(row.created_at).getTime();
    const timeB = new Date(rowB.created_at).getTime();
    const timeDiff = Math.abs(timeA - timeB);
    
    return (
      row.sales_id === rowB.sales_id &&
      timeDiff <= 60000 &&
      row.product_category_id === rowB.product_category_id &&
      String(row.note || '').trim() === String(rowB.note || '').trim() &&
      String(row.customer_name || '').trim() === String(rowB.customer_name || '').trim() &&
      String(row.phone || '').trim() === String(rowB.phone || '').trim() &&
      String(row.project_name || '').trim() === String(rowB.project_name || '').trim()
    );
  });
  
  if (duplicates.length <= 1) return "";
  
  duplicates.sort((a, b) => a.id.localeCompare(b.id));
  const primaryId = duplicates[0].id;
  
  let hash = 0;
  for (let i = 0; i < primaryId.length; i++) {
    hash = primaryId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
};

export default function DetailedDataCheckerPage() {
  const [allData, setAllData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- State สำหรับ Master Data (ทำ Dropdown) ---
  const [salesList, setSalesList] = useState<any[]>([]);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [productCategories, setProductCategories] = useState<any[]>([]);

  // --- State สำหรับระบบ Bulk Edit ---
  const [isEditMode, setIsEditMode] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // --- State สำหรับระบบ Filter หลัก ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterSource, setFilterSource] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // --- State สำหรับระบบ Filter ใหม่ ---
  const [filterSales, setFilterSales] = useState("ALL");
  const [filterProjectType, setFilterProjectType] = useState("ALL");
  const [filterProductCategory, setFilterProductCategory] = useState("ALL");
  const [minArea, setMinArea] = useState("");
  const [maxArea, setMaxArea] = useState("");

  // --- State สำหรับระบบ Checkbox และ Bulk Delete ---
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  // --- State สำหรับ Infinite Scroll ---
  const [displayLimit, setDisplayLimit] = useState(50);

  // --- State สำหรับดูข้อมูลซ้ำ ---
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  // --- 1. ฟังก์ชันดึงข้อมูล ---
  const fetchDetailedData = async () => {
    setLoading(true);
    try {
      // ดึง lookup tables ทั้งหมดพร้อมกัน
      const [
        { data: profiles },
        { data: teams },
        { data: pTypes },
        { data: pCats },
        { data: companies },
        { data: customerTypes },
      ] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, role"),
        supabase.from("teams").select("id, team_name"),
        supabase.from("project_types").select("id, name"),
        supabase.from("product_categories").select("id, name"),
        supabase.from("companies").select("id, name"),
        supabase.from("customer_types").select("id, name"),
      ]);

      setSalesList(profiles || []);
      setProjectTypes(pTypes || []);
      setProductCategories(pCats || []);

      // สร้าง lookup maps
      const profileMap    = (profiles     || []).reduce((acc: any, r) => ({ ...acc, [r.id]: r }), {});
      const teamMap       = (teams        || []).reduce((acc: any, r) => ({ ...acc, [r.id]: r.team_name }), {});
      const projectTypeMap= (pTypes       || []).reduce((acc: any, r) => ({ ...acc, [r.id]: r.name }), {});
      const productCatMap = (pCats        || []).reduce((acc: any, r) => ({ ...acc, [r.id]: r.name }), {});
      const companyMap    = (companies    || []).reduce((acc: any, r) => ({ ...acc, [r.id]: r.name }), {});
      const custTypeMap   = (customerTypes|| []).reduce((acc: any, r) => ({ ...acc, [r.id]: r.name }), {});

      // ดึงข้อมูลหลัก (pagination)
      let allProjects: any[] = [];
      let isFetching = true;
      let startRow = 0;
      const step = 1000;

      while (isFetching) {
        const { data: mainData, error: mainError } = await supabase
          .from("order_item_projects")
          .select(`
            id, project_name, area_sqm, is_deleted, is_important, created_at,
            project_type_id,
            account_developer, contact_developer,
            account_architecture, contact_architecture,
            account_interior, contact_interior,
            account_contractor, contact_contractor,
            order_items (
              id, note, interest_level, product_category_id,
              orders (
                id, customer_name, phone, source,
                user_id, team_id, company_id, customer_type_id,
                is_synced, audit_log
              )
            )
          `)
          .order("created_at", { ascending: false })
          .range(startRow, startRow + step - 1);

        if (mainError) throw mainError;
        if (mainData && mainData.length > 0) {
          allProjects = [...allProjects, ...mainData];
          startRow += step;
        }
        if (!mainData || mainData.length < step) isFetching = false;
      }

      const flattenedData = allProjects.map((proj: any) => {
        const item  = proj.order_items || {};
        const order = item.orders || {};
        const salesProfile = profileMap[order.user_id] || {};
        const isImported   = order.audit_log === null || order.audit_log === undefined;

        return {
          // --- Project ---
          id:               proj.id,
          project_name:     proj.project_name    || "-",
          area_sqm:         proj.area_sqm        ?? 0,
          is_deleted:       proj.is_deleted      ?? false,
          is_important:     proj.is_important    ?? false,
          created_at:       proj.created_at,
          project_type_id:  proj.project_type_id || null,
          project_type_name:projectTypeMap[proj.project_type_id] || "-",

          // --- Contact Accounts ---
          account_developer:    proj.account_developer    || "",
          contact_developer:    proj.contact_developer    || "",
          account_architecture: proj.account_architecture || "",
          contact_architecture: proj.contact_architecture || "",
          account_interior:     proj.account_interior     || "",
          contact_interior:     proj.contact_interior     || "",
          account_contractor:   proj.account_contractor   || "",
          contact_contractor:   proj.contact_contractor   || "",

          // --- Order Item ---
          item_id:              item.id                   || null,
          note:                 item.note                 || "",
          interest_level:       item.interest_level       || "",
          product_category_id:  item.product_category_id  || null,
          product_category_name:productCatMap[item.product_category_id] || "-",

          // --- Order ---
          order_id:             order.id                  || null,
          customer_name:        order.customer_name       || "-",
          phone:                order.phone               || "-",
          source:               order.source              || "-",
          is_synced:            order.is_synced           ?? false,
          data_source:          isImported ? "IMPORT" : "APP",

          // --- Relations (from orders) ---
          company_id:           order.company_id          || null,
          company_name:         companyMap[order.company_id]          || "-",
          customer_type_id:     order.customer_type_id    || null,
          customer_type_name:   custTypeMap[order.customer_type_id]   || "-",
          team_id:              order.team_id             || null,
          team_name:            teamMap[order.team_id]                || "ไม่ระบุทีม",

          // --- Sales ---
          sales_id:             order.user_id             || null,
          sales_name:           salesProfile.full_name    || "ไม่ระบุเซลส์",
          sales_email:          salesProfile.email        || "",
        };
      });

      setAllData(flattenedData);
      setFilteredData(flattenedData);
      setDrafts({});
      setIsEditMode(false);
      setSelectedRows([]);

    } catch (error: any) {
      console.error("Fetch Error:", error);
      alert(`ดึงข้อมูลไม่สำเร็จ: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetailedData();
  }, []);

  // --- 2. ฟังก์ชันระบบค้นหา & กรองข้อมูล ---
  useEffect(() => {
    let result = allData;
    
    if (filterStatus === "DELETED") result = result.filter(item => item.is_deleted === true);
    else if (filterStatus === "ACTIVE") result = result.filter(item => item.is_deleted === false || item.is_deleted === null);
    
    if (filterSource === "APP") result = result.filter(item => item.data_source === "APP");
    else if (filterSource === "IMPORT") result = result.filter(item => item.data_source === "IMPORT");

    if (filterSales !== "ALL") result = result.filter(item => item.sales_id === filterSales);
    if (filterProjectType !== "ALL") result = result.filter(item => item.project_type_id === filterProjectType);
    if (filterProductCategory !== "ALL") result = result.filter(item => item.product_category_id === filterProductCategory);

    if (minArea !== "") result = result.filter(item => Number(item.area_sqm) >= Number(minArea));
    if (maxArea !== "") result = result.filter(item => Number(item.area_sqm) <= Number(maxArea));

    if (searchTerm.trim() !== "") {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.project_name.toLowerCase().includes(lowerSearch) ||
        item.customer_name.toLowerCase().includes(lowerSearch) ||
        item.sales_name.toLowerCase().includes(lowerSearch) ||
        item.id.toLowerCase().includes(lowerSearch)
      );
    }
    
    if (startDate) {
      const startTime = new Date(startDate).getTime();
      result = result.filter(item => new Date(item.created_at).getTime() >= startTime);
    }
    if (endDate) {
      const endTime = new Date(endDate).getTime();
      result = result.filter(item => new Date(item.created_at).getTime() <= endTime);
    }

    // 🕵️ กรองเฉพาะข้อมูลที่น่าจะซ้ำกัน
    if (showDuplicatesOnly) {
      result = result.filter((rowA) => {
        return allData.some((rowB) => {
          if (rowA.id === rowB.id) return false;
          
          const timeA = new Date(rowA.created_at).getTime();
          const timeB = new Date(rowB.created_at).getTime();
          const timeDiff = Math.abs(timeA - timeB);
          
          return (
            rowA.sales_id === rowB.sales_id &&
            timeDiff <= 60000 && // ภายใน 1 นาที
            rowA.product_category_id === rowB.product_category_id &&
            String(rowA.note || '').trim() === String(rowB.note || '').trim() &&
            String(rowA.customer_name || '').trim() === String(rowB.customer_name || '').trim() &&
            String(rowA.phone || '').trim() === String(rowB.phone || '').trim() &&
            String(rowA.project_name || '').trim() === String(rowB.project_name || '').trim()
          );
        });
      });
    }
    
    setFilteredData(result);
    setDisplayLimit(50);
  }, [searchTerm, filterStatus, filterSource, filterSales, filterProjectType, filterProductCategory, minArea, maxArea, startDate, endDate, allData, showDuplicatesOnly]);

  // --- 3. ฟังก์ชันระบบจัดการ Checkbox ---
  const dataToDisplay = filteredData.slice(0, displayLimit);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedRows(dataToDisplay.map(item => item.id));
    else setSelectedRows([]);
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]);
  };

  // --- 4. ฟังก์ชันจัดการการลบ ---
  const handleBulkSoftDelete = async () => {
    if (!window.confirm(`ย้าย ${selectedRows.length} รายการลงถังขยะ ใช่หรือไม่?`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('order_item_projects').update({ is_deleted: true }).in('id', selectedRows);
      if (error) throw error;
      setAllData(prev => prev.map(item => selectedRows.includes(item.id) ? { ...item, is_deleted: true } : item));
      setSelectedRows([]);
    } catch (error: any) { alert(`ลบไม่สำเร็จ: ${error.message}`); } finally { setSaving(false); }
  };

  const handleBulkHardDelete = async () => {
    if (!window.confirm(`⚠️ คำเตือน: คุณกำลังจะ "ลบถาวร" ${selectedRows.length} รายการออกจากฐานข้อมูล (Orders/Items/Projects)\n\nกู้คืนไม่ได้ ยืนยันหรือไม่?`)) return;
    setSaving(true);
    try {
      const itemsToDelete = allData.filter(d => selectedRows.includes(d.id));
      const projectIds = itemsToDelete.map(p => p.id);
      const itemIds = itemsToDelete.map(p => p.item_id).filter(Boolean);
      const orderIds = itemsToDelete.map(p => p.order_id).filter(Boolean);

      if (projectIds.length > 0) await supabase.from('order_item_projects').delete().in('id', projectIds);
      if (itemIds.length > 0) await supabase.from('order_items').delete().in('id', itemIds);
      if (orderIds.length > 0) await supabase.from('orders').delete().in('id', orderIds);

      setAllData(prev => prev.filter(item => !selectedRows.includes(item.id)));
      setSelectedRows([]);
      alert('ลบถาวรเรียบร้อยครับนาย!');
    } catch (error: any) { alert(`ลบไม่สำเร็จ: ${error.message}`); } finally { setSaving(false); }
  };

  const handleHardDeleteSingle = async (row: any) => {
    if (!window.confirm(`⚠️ ยืนยันลบ "${row.project_name}" ออกจาก Database ถาวร?\n(ลบทั้ง Orders, Items, Projects)`)) return;
    try {
      if (row.id) await supabase.from('order_item_projects').delete().eq('id', row.id);
      if (row.item_id) await supabase.from('order_items').delete().eq('id', row.item_id);
      if (row.order_id) await supabase.from('orders').delete().eq('id', row.order_id);
      setAllData(prev => prev.filter(item => item.id !== row.id));
    } catch (error: any) { alert(`ลบไม่สำเร็จ: ${error.message}`); }
  };

  const handleToggleDeleteStatus = async (projectId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      await supabase.from('order_item_projects').update({ is_deleted: newStatus }).eq('id', projectId);
      setAllData(prev => prev.map(item => item.id === projectId ? { ...item, is_deleted: newStatus } : item));
    } catch (error: any) { alert(`ทำรายการไม่สำเร็จ`); }
  };

  // --- 5. ฟังก์ชันระบบแก้ข้อมูลหลายบรรทัดพร้อมกัน (Bulk Edit) ---
  const handleDraftChange = (rowId: string, field: string, value: any) => {
    setDrafts((prev) => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [field]: value } }));
  };

  const handleSaveAllChanges = async () => {
    const rowIdsToUpdate = Object.keys(drafts);
    if (rowIdsToUpdate.length === 0) return setIsEditMode(false);
    if (!window.confirm(`ยืนยันการบันทึก ${rowIdsToUpdate.length} รายการ?`)) return;
    setSaving(true);
    try {
      for (const id of rowIdsToUpdate) {
        const changes = drafts[id];
        const originalRow = allData.find(r => r.id === id);
        if (!originalRow) continue;
        
        const projectPayload: any = {};
        const itemPayload: any = {};
        const orderPayload: any = {};
        
        const projectFields = [
          'project_name', 'area_sqm', 'created_at', 'project_type_id',
          'account_developer', 'contact_developer', 
          'account_architecture', 'contact_architecture', 
          'account_interior', 'contact_interior', 
          'account_contractor', 'contact_contractor'
        ];
        const itemFields = ['note', 'interest_level', 'product_category_id'];
        
        // ✨ เพิ่ม user_id เข้าไปใน orderFields เพื่ออัปเดตคนดูแล (เซลส์)
        const orderFields = ['customer_name', 'phone', 'user_id'];
        
        for (const key in changes) {
          if (projectFields.includes(key)) projectPayload[key] = changes[key];
          if (itemFields.includes(key)) itemPayload[key] = changes[key];
          if (orderFields.includes(key)) orderPayload[key] = changes[key];
        }
        if (Object.keys(projectPayload).length > 0) await supabase.from('order_item_projects').update(projectPayload).eq('id', id);
        if (Object.keys(itemPayload).length > 0 && originalRow.item_id) await supabase.from('order_items').update(itemPayload).eq('id', originalRow.item_id);
        if (Object.keys(orderPayload).length > 0 && originalRow.order_id) await supabase.from('orders').update(orderPayload).eq('id', originalRow.order_id);
      }
      fetchDetailedData();
    } catch (error: any) { alert(`ไม่สำเร็จ: ${error.message}`); } finally { setSaving(false); }
  };

  const handleCancelEdit = () => {
    if (Object.keys(drafts).length > 0 && !window.confirm("ยกเลิกการแก้ไขใช่หรือไม่?")) return;
    setDrafts({});
    setIsEditMode(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100 && displayLimit < filteredData.length) setDisplayLimit(prev => prev + 50);
  };

  // --- 6. ฟังก์ชัน Export (ตามข้อมูลที่กรองอยู่) ---
  // คอลัมน์ export ครบถ้วนตามโครงสร้าง DB
  const EXPORT_COLUMNS: { header: string; key: string; format?: (v: any) => string }[] = [
    // ── เวลา ──────────────────────────────────────────────────────────────
    { header: "วันที่สร้าง",        key: "created_at",          format: (v) => v ? new Date(v).toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-" },
    { header: "เวลา",               key: "created_at",          format: (v) => v ? new Date(v).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-" },

    // ── ข้อมูลโปรเจกต์ (order_item_projects) ────────────────────────────
    { header: "ชื่อโปรเจกต์",       key: "project_name" },
    { header: "พื้นที่ (ตร.ม.)",    key: "area_sqm" },
    { header: "ประเภทโครงการ",      key: "project_type_name" },
    { header: "สถานะ",              key: "is_deleted",          format: (v) => v ? "ถังขยะ" : "ปกติ" },

    // ── ข้อมูลลูกค้า (orders) ────────────────────────────────────────────
    { header: "ชื่อลูกค้า",         key: "customer_name" },
    { header: "เบอร์โทรศัพท์",      key: "phone" },
    { header: "ช่องทางข้อมูล",      key: "data_source",         format: (v) => v === "IMPORT" ? "นำเข้าไฟล์" : "ผ่านแอปฯ" },
    { header: "ซิงค์แล้ว",          key: "is_synced",           format: (v) => v ? "✓ ซิงค์แล้ว" : "ยังไม่ซิงค์" },

    // ── ข้อมูลเซลส์ / ทีม (profiles, teams) ─────────────────────────────
    { header: "เซลส์ดูแล",          key: "sales_name" },
    { header: "ทีม",                key: "team_name" },

    // ── ข้อมูล Order Item ────────────────────────────────────────────────
    { header: "ประเภทสินค้า",       key: "product_category_name" },
    { header: "ความสนใจ",           key: "interest_level" },
    { header: "หมายเหตุ",           key: "note" },

    // ── ผู้ติดต่อโปรเจกต์ (order_item_projects contacts) ────────────────
    { header: "Developer (ชื่อ)",   key: "account_developer" },
    { header: "Developer (เบอร์)",  key: "contact_developer" },
    { header: "Architect (ชื่อ)",   key: "account_architecture" },
    { header: "Architect (เบอร์)",  key: "contact_architecture" },
    { header: "Interior (ชื่อ)",    key: "account_interior" },
    { header: "Interior (เบอร์)",   key: "contact_interior" },
    { header: "Contractor (ชื่อ)",  key: "account_contractor" },
    { header: "Contractor (เบอร์)", key: "contact_contractor" },
  ];

  const buildExportRows = () =>
    filteredData.map(row =>
      EXPORT_COLUMNS.reduce((acc: any, col) => {
        const raw = row[col.key];
        acc[col.header] = col.format ? col.format(raw) : (raw ?? "-");
        return acc;
      }, {})
    );

  const getFilename = (ext: string) => {
    const now = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "-");
    return `DataSheet_${now}_${filteredData.length}รายการ.${ext}`;
  };

  const handleExportXLSX = () => {
    const rows = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);

    // ปรับความกว้างคอลัมน์ตามเนื้อหา
    const colWidths = EXPORT_COLUMNS.map(col => {
      const maxContentLen = rows.reduce((max, row) => {
        const val = String(row[col.header] ?? "");
        return Math.max(max, val.length);
      }, col.header.length);
      return { wch: Math.min(Math.max(maxContentLen + 2, 10), 50) };
    });
    ws["!cols"] = colWidths;

    // ตรึง header row
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DataSheet");
    XLSX.writeFile(wb, getFilename("xlsx"));
  };

  const handleExportCSV = () => {
    const rows = buildExportRows();
    const headers = EXPORT_COLUMNS.map(c => `"${c.header}"`).join(",");
    const body = rows.map(row =>
      EXPORT_COLUMNS.map(c => {
        const val = String(row[c.header] ?? "").replace(/"/g, '""');
        return `"${val}"`;
      }).join(",")
    ).join("\n");
    const bom = "\uFEFF"; // UTF-8 BOM ให้ Excel เปิดภาษาไทยถูก
    const blob = new Blob([bom + headers + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getFilename("csv");
    a.click();
    URL.revokeObjectURL(url);
  };

// --- ฟังก์ชันสำหรับ Render ช่องปกติ ---
  const renderEditableCell = (row: any, field: string, type = "text", width = "w-full") => {
    if (!isEditMode) return <span className="truncate block">{row[field] || "-"}</span>;
    let value = drafts[row.id]?.[field] ?? row[field] ?? "";
    if (type === "datetime-local" && value && !drafts[row.id]?.[field]) value = new Date(value).toISOString().slice(0, 16);
    return (
      <input type={type} value={value} onChange={(e) => handleDraftChange(row.id, field, e.target.value)}
        className={`${width} px-2 py-1 text-xs border border-blue-300 bg-white rounded outline-none focus:ring-2 focus:ring-blue-500 shadow-sm`}
      />
    );
  };

  // --- ฟังก์ชันสำหรับ Render ชื่อ + เบอร์ติดต่อ ---
  const renderContactCell = (row: any, accountField: string, contactField: string) => {
    if (!isEditMode) {
      return (
        <div className="flex flex-col gap-0.5 max-w-[180px]">
          <span className="text-gray-800 font-medium truncate" title={row[accountField]}>{row[accountField] || "-"}</span>
          {row[contactField] && (
            <span className="text-gray-500 text-[10px] flex items-center gap-1 truncate" title={row[contactField]}>
              📞 {row[contactField]}
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1 w-[160px]">
        <input 
          type="text" placeholder="ชื่อ / บริษัท"
          value={drafts[row.id]?.[accountField] ?? row[accountField] ?? ""} 
          onChange={(e) => handleDraftChange(row.id, accountField, e.target.value)}
          className="w-full px-2 py-1 text-[11px] border border-blue-300 bg-white rounded outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
        />
        <input 
          type="text" placeholder="เบอร์โทร / ไลน์"
          value={drafts[row.id]?.[contactField] ?? row[contactField] ?? ""} 
          onChange={(e) => handleDraftChange(row.id, contactField, e.target.value)}
          className="w-full px-2 py-1 text-[11px] border border-blue-300 bg-white rounded outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-0 pt-20 px-4 md:px-5 pb-5 bg-slate-100 flex flex-col font-sans overflow-hidden">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex-1 flex flex-col overflow-hidden relative">
        
        {/* --- Toolbar --- */}
        <div className="flex-none bg-white border-b border-gray-200 px-5 py-3 shadow-sm z-20 flex flex-col gap-3">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white"><FileSpreadsheet size={20} /></div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">DataSheet Pro</h1>
                <p className="text-xs text-gray-500 mt-1">{filteredData.length} Records</p>
              </div>
            </div>

            <div className="flex flex-wrap w-full xl:w-auto items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input type="text" placeholder="ค้นหา..." className="w-32 md:w-36 lg:w-48 border rounded-md pl-9 pr-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={isEditMode} />
              </div>

              <div className="flex items-center gap-1 bg-gray-50 border rounded-md px-2 py-1">
                <Calendar size={14} className="text-gray-500" />
                <input type="datetime-local" className="bg-transparent text-xs outline-none w-[130px]" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={isEditMode} />
                <span className="text-gray-400">-</span>
                <input type="datetime-local" className="bg-transparent text-xs outline-none w-[130px]" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={isEditMode} />
              </div>

              <select className="border rounded-md px-2 py-1.5 text-sm bg-blue-50 text-blue-800 font-medium outline-none" value={filterSource} onChange={(e) => setFilterSource(e.target.value)} disabled={isEditMode}>
                <option value="ALL">ที่มา: ทั้งหมด</option>
                <option value="APP">📱 ผ่านแอปฯ</option>
                <option value="IMPORT">📁 นำเข้าไฟล์</option>
              </select>

              <select className="border rounded-md px-2 py-1.5 text-sm outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} disabled={isEditMode}>
                <option value="ALL">สถานะ: ทั้งหมด</option>
                <option value="ACTIVE">ปกติ</option>
                <option value="DELETED">ถังขยะ</option>
              </select>

              {!isEditMode && selectedRows.length > 0 && (
                <div className="flex gap-1 animate-fade-in bg-red-50 p-1 rounded-lg border border-red-100">
                  <button onClick={handleBulkSoftDelete} className="bg-orange-500 text-white px-3 py-1.5 rounded-md text-xs font-medium shadow flex items-center gap-1.5"><Trash2 size={14} /> ถังขยะ ({selectedRows.length})</button>
                  <button onClick={handleBulkHardDelete} className="bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow flex items-center gap-1.5"><AlertTriangle size={14} /> ลบถาวร ({selectedRows.length})</button>
                </div>
              )}

              {isEditMode ? (
                <div className="flex gap-2">
                  <button onClick={handleSaveAllChanges} className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-bold shadow flex items-center gap-2"><Save size={16} /> บันทึก</button>
                  <button onClick={handleCancelEdit} className="bg-gray-100 text-gray-700 border px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2"><X size={16} /> ยกเลิก</button>
                </div>
              ) : (
                <button onClick={() => setIsEditMode(true)} className="bg-slate-800 text-white px-3 py-1.5 rounded-md text-sm font-medium shadow flex items-center gap-2"><Edit3 size={16} /> แก้ไขตาราง</button>
              )}

              {!isEditMode && (
                <button
                  onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border shadow-sm transition ${
                    showDuplicatesOnly
                      ? "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                  title="แสดงเฉพาะข้อมูลที่ส่งซ้ำกันภายใน 1 นาที"
                >
                  <AlertTriangle size={16} className={showDuplicatesOnly ? "text-amber-700 animate-pulse" : "text-amber-500"} />
                  <span>{showDuplicatesOnly ? "แสดงทั้งหมด" : "ดูข้อมูลซ้ำ"}</span>
                </button>
              )}

              {!isEditMode && (
                <button onClick={fetchDetailedData} disabled={loading} className="bg-gray-50 border px-2 py-1.5 rounded-md transition" title="รีเฟรชข้อมูล">
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
              )}

              {/* ปุ่ม Export */}
              {!isEditMode && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleExportXLSX}
                    disabled={filteredData.length === 0}
                    title={`Export ${filteredData.length} รายการ เป็น Excel (.xlsx)`}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md text-xs font-bold shadow transition"
                  >
                    <Download size={14} />
                    XLSX
                  </button>
                  <button
                    onClick={handleExportCSV}
                    disabled={filteredData.length === 0}
                    title={`Export ${filteredData.length} รายการ เป็น CSV`}
                    className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md text-xs font-bold shadow transition"
                  >
                    <Download size={14} />
                    CSV
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* แถบ Filter */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
            <Filter size={14} className="text-gray-400 mr-1" />
            
            <select className="border rounded-md px-2 py-1 text-xs outline-none bg-blue-50 text-blue-800" value={filterSales} onChange={(e) => setFilterSales(e.target.value)} disabled={isEditMode}>
              <option value="ALL">เซลส์: ทั้งหมด</option>
              {salesList.map(s => <option key={s.id} value={s.id}>{s.full_name || 'ไม่ระบุชื่อ'}</option>)}
            </select>

            <select className="border rounded-md px-2 py-1 text-xs outline-none bg-indigo-50 text-indigo-800" value={filterProjectType} onChange={(e) => setFilterProjectType(e.target.value)} disabled={isEditMode}>
              <option value="ALL">ประเภทโครงการ: ทั้งหมด</option>
              {projectTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <select className="border rounded-md px-2 py-1 text-xs outline-none bg-teal-50 text-teal-800" value={filterProductCategory} onChange={(e) => setFilterProductCategory(e.target.value)} disabled={isEditMode}>
              <option value="ALL">ประเภทสินค้า: ทั้งหมด</option>
              {productCategories.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <div className="flex items-center gap-1 border rounded-md px-2 py-1 bg-white">
              <span className="text-xs text-gray-500 font-medium">พื้นที่ (ตร.ม.):</span>
              <input type="number" placeholder="Min" className="w-14 text-xs outline-none bg-transparent" value={minArea} onChange={(e) => setMinArea(e.target.value)} disabled={isEditMode} />
              <span className="text-gray-300">-</span>
              <input type="number" placeholder="Max" className="w-14 text-xs outline-none bg-transparent" value={maxArea} onChange={(e) => setMaxArea(e.target.value)} disabled={isEditMode} />
            </div>
          </div>
        </div>

        {/* --- Table --- */}
        <div className="flex-1 overflow-auto bg-gray-50 relative custom-scrollbar" onScroll={handleScroll}>
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-max">
            <thead className="bg-gray-200 text-gray-600 text-[11px] uppercase font-bold sticky top-0 z-20 shadow-sm border-b tracking-wider">
              <tr>
                {!isEditMode && <th className="px-3 py-2.5 border-r sticky left-0 bg-gray-200 z-30 text-center w-10 shadow-[1px_0_0_#d1d5db]"><input type="checkbox" onChange={handleSelectAll} checked={dataToDisplay.length > 0 && selectedRows.length === dataToDisplay.length} /></th>}
                
                {/* แยกคอลัมน์ วันที่ / เวลา / ที่มา */}
                <th className="px-4 py-2.5 border-r border-gray-300 whitespace-nowrap">วันที่สร้าง</th>
                <th className="px-4 py-2.5 border-r border-gray-300 whitespace-nowrap">เวลา</th>
                <th className="px-2 py-2.5 border-r border-gray-300 text-center">ที่มา</th>
                
                <th className="px-4 py-2.5 border-r border-gray-300">ชื่อโปรเจกต์</th>
                <th className="px-4 py-2.5 border-r border-gray-300 text-right">พื้นที่ (ตร.ม.)</th>
                <th className="px-4 py-2.5 border-r border-gray-300">ชื่อลูกค้า</th>
                <th className="px-4 py-2.5 border-r border-gray-300">เบอร์โทรศัพท์</th>
                <th className="px-4 py-2.5 border-r border-gray-300">เซลส์ดูแล</th>
                <th className="px-4 py-2.5 border-r border-gray-300">ประเภทโครงการ</th>
                <th className="px-4 py-2.5 border-r border-gray-300">ประเภทสินค้า</th>
                <th className="px-4 py-2.5 border-r border-gray-300">ความสนใจ</th>
                <th className="px-4 py-2.5 border-r border-gray-300">หมายเหตุ</th>
                <th className="px-4 py-2.5 border-r border-gray-300">Developer (ชื่อ/เบอร์)</th>
                <th className="px-4 py-2.5 border-r border-gray-300">Architect (ชื่อ/เบอร์)</th>
                <th className="px-4 py-2.5 border-r border-gray-300">Interior (ชื่อ/เบอร์)</th>
                <th className="px-4 py-2.5 border-r border-gray-300">Contractor (ชื่อ/เบอร์)</th>
                {!isEditMode && <th className="px-2 py-2.5 border-l sticky right-0 bg-gray-200 z-30 text-center w-32 shadow-[-1px_0_0_#d1d5db]">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="bg-white text-xs text-gray-800">
              {loading ? (
                <tr><td colSpan={21} className="text-center py-16"><RefreshCw size={20} className="animate-spin inline mr-2" /> กำลังโหลด...</td></tr>
              ) : (
                dataToDisplay.map((row) => {
                  const dupColor = getDuplicateGroupColor(row, allData);
                  let rowBgClass = "bg-white hover:bg-slate-50";
                  if (dupColor) rowBgClass = dupColor;
                  if (row.is_deleted) rowBgClass = "bg-red-50 text-red-700 hover:bg-red-100";
                  if (selectedRows.includes(row.id)) rowBgClass = "bg-blue-100 text-blue-950";

                  return (
                    <tr key={row.id} className={`transition-colors border-b ${rowBgClass}`}>
                      {!isEditMode && <td className="px-3 py-1.5 border-r sticky left-0 z-10 text-center bg-inherit"><input type="checkbox" checked={selectedRows.includes(row.id)} onChange={() => handleSelectRow(row.id)} /></td>}
                    
                    {/* คอลัมน์ "วันที่" และ "เวลา" แยกกัน */}
                    <td className="px-3 py-2 border-r min-w-[110px] whitespace-nowrap">
                      {isEditMode ? (
                        <input
                          type="datetime-local"
                          value={drafts[row.id]?.created_at ? new Date(drafts[row.id].created_at).toISOString().slice(0, 16) : new Date(row.created_at).toISOString().slice(0, 16)}
                          onChange={(e) => handleDraftChange(row.id, 'created_at', new Date(e.target.value).toISOString())}
                          className="w-full px-2 py-1 text-xs border border-blue-300 bg-white rounded outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                        />
                      ) : (
                        <span>{new Date(row.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" })}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-r min-w-[75px] whitespace-nowrap text-gray-500">
                      {!isEditMode && (
                        <span>{new Date(row.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                      )}
                    </td>

                    {/* คอลัมน์ "ที่มา" ถูกแยกออกมาแล้ว */}
                    <td className="px-2 py-2 border-r min-w-[80px] text-center">
                      {row.data_source === "IMPORT" ? <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] w-fit mx-auto">📁 นำเข้าไฟล์</span> : <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] w-fit mx-auto">📱 ผ่านแอปฯ</span>}
                    </td>

                    <td className="px-3 py-1.5 border-r font-medium min-w-[200px] max-w-[250px]">{renderEditableCell(row, "project_name")}</td>
<td className="px-3 py-1.5 border-r text-right min-w-[80px]">{renderEditableCell(row, "area_sqm", "number")}</td>
<td className="px-3 py-1.5 border-r min-w-[150px] max-w-[200px]">{renderEditableCell(row, "customer_name")}</td>
<td className="px-3 py-1.5 border-r min-w-[120px] max-w-[150px]">{renderEditableCell(row, "phone")}</td>
                    {/* คอลัมน์ "เซลส์ดูแล" แก้ไขได้ด้วย Dropdown */}
                    <td className="px-3 py-1.5 border-r min-w-[140px] text-gray-600">
                      {isEditMode ? (
                        <select 
                          value={drafts[row.id]?.user_id ?? row.sales_id ?? ""} 
                          onChange={(e) => handleDraftChange(row.id, 'user_id', e.target.value)} 
                          className="w-full px-1 py-1 border border-blue-300 rounded text-[11px] outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          <option value="">- เลือกเซลส์ -</option>
                          {salesList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                        </select>
                      ) : (
                        <span className="text-blue-700 font-medium truncate block" title={row.sales_name}>{row.sales_name}</span>
                      )}
                    </td>

                    <td className="px-3 py-1.5 border-r min-w-[140px] text-gray-600">
                      {isEditMode ? (
                        <select 
                          value={drafts[row.id]?.project_type_id ?? row.project_type_id ?? ""} 
                          onChange={(e) => handleDraftChange(row.id, 'project_type_id', e.target.value)} 
                          className="w-full px-1 py-1 border border-blue-300 rounded text-[11px] outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          <option value="">- เลือก -</option>
                          {projectTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      ) : <span className="truncate block" title={row.project_type_name}>{row.project_type_name}</span>}
                    </td>
                    <td className="px-3 py-1.5 border-r min-w-[140px] text-gray-600">
                      {isEditMode ? (
                        <select 
                          value={drafts[row.id]?.product_category_id ?? row.product_category_id ?? ""} 
                          onChange={(e) => handleDraftChange(row.id, 'product_category_id', e.target.value)} 
                          className="w-full px-1 py-1 border border-blue-300 rounded text-[11px] outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          <option value="">- เลือก -</option>
                          {productCategories.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      ) : <span className="truncate block" title={row.product_category_name}>{row.product_category_name}</span>}
                    </td>

                    <td className="px-3 py-1.5 border-r min-w-[100px]">{renderEditableCell(row, "interest_level")}</td>
<td className="px-3 py-1.5 border-r min-w-[200px] max-w-[300px]">{renderEditableCell(row, "note")}</td>

<td className="px-3 py-2 border-r align-top">{renderContactCell(row, "account_developer", "contact_developer")}</td>
<td className="px-3 py-2 border-r align-top">{renderContactCell(row, "account_architecture", "contact_architecture")}</td>
<td className="px-3 py-2 border-r align-top">{renderContactCell(row, "account_interior", "contact_interior")}</td>
<td className="px-3 py-2 border-r align-top">{renderContactCell(row, "account_contractor", "contact_contractor")}</td>
                    {!isEditMode && (
                      <td className="px-2 py-1.5 border-l sticky right-0 z-10 text-center bg-inherit shadow-[-1px_0_0_#e5e7eb]">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => handleToggleDeleteStatus(row.id, row.is_deleted)} className={`p-1.5 rounded ${row.is_deleted ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-600'}`} title="เทสลบ/กู้คืน">{row.is_deleted ? <RotateCcw size={14} /> : <Trash2 size={14} />}</button>
                          <button onClick={() => handleHardDeleteSingle(row)} className="p-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200" title="ลบถาวร"><AlertTriangle size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `.animate-fade-in { animation: fadeIn 0.3s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}} />
    </div>
  );
}