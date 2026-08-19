'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  ShoppingBag, Menu, X,
  LayoutDashboard, Building2, Package,
  SearchCheck, ClipboardCheck, Sparkles, ImageIcon,
  Cloud, ImagePlus, UserPlus, HardDrive,
  BookOpen, LogOut
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function RootLayoutClient({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null); // สเตทรักษายศของผู้ใช้ (admin / user)
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/catalog');

  // 🌟 ดึงข้อมูล Role ของคนที่ล็อกอินอยู่ ณ ปัจจุบัน
  useEffect(() => {
    if (isPublicPage) return;

    let isActive = true;

    const checkRole = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          throw authError || new Error('ไม่พบเซสชันผู้ใช้');
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (isActive) {
          setUserRole(profile?.role || 'user');
        }
      } catch (error) {
        // Refresh token อาจหมดอายุ/ถูกลบ: ล้างเฉพาะ session ในเครื่อง แล้วให้ล็อกอินใหม่
        console.warn('Session is invalid. Returning to login.', error);
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch (_) {
          // เมื่อ refresh token เสีย signOut อาจตอบ error ได้ แต่ยังต้องพากลับหน้า login
        }
        document.cookie = 'admin_token=; path=/; max-age=0; SameSite=Lax;';
        if (isActive) {
          setUserRole(null);
          router.replace('/login');
        }
      }
    };
    void checkRole();

    return () => {
      isActive = false;
    };
  }, [isPublicPage, pathname, router]); // เช็คใหม่ทุกครั้งที่มีการเปลี่ยนหน้า

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'admin_token=; path=/; max-age=0; SameSite=Lax;';
    router.push('/login');
  };

  // 🚷 🌟 ระบบป้องกันหลังบ้านเวอร์ชันอัปเดต (แก้ไขปลดล็อกหน้าบริษัท)
  useEffect(() => {
    if (!isPublicPage && userRole === 'user') {
      // 🟢 อัปเดตเพิ่มเงื่อนไขเช็กหน้า /dashboard/companies/ ต่อท้ายเข้าไปตรงนี้ครับ
      const isDashboardZone = 
        pathname === '/dashboard' || 
        pathname === '/dashboardadvance' ||
        pathname.startsWith('/dashboard/checkins/') ||
        pathname.startsWith('/dashboard/companies/'); 
      
      if (!isDashboardZone) {
        router.push('/dashboard');
      }
    }
  }, [userRole, pathname, isPublicPage, router]);

  // 📝 รายการเมนู
  const menuGroups = [
    {
      title: 'Overview & AI',
      items: [
        { name: 'หน้าแรก (Dashboard)', path: '/dashboard', icon: LayoutDashboard, color: 'blue', adminOnly: false }, // ให้ user เข้าได้
        { name: 'Dashboard Advance', path: '/dashboardadvance', icon: LayoutDashboard, color: 'blue', adminOnly: false },
        { name: 'จัดการบริษัทคู่ค้า', path: '/companies', icon: Building2, color: 'blue', adminOnly: true },
      ]
    },
    {
      title: 'Inventory & Operations',
      items: [
        { name: 'จัดการสินค้า', path: '/manage-products', icon: Package, color: 'blue', adminOnly: true },
        { name: 'จัดการคลังสินค้า', path: '/inventory/master', icon: ShoppingBag, color: 'blue', adminOnly: true }, 
        { name: 'ตรวจสอบข้อมูล', path: '/check-data', icon: SearchCheck, color: 'blue', adminOnly: true },
        { name: 'ตรวจสอบแผนงาน', path: '/check-visit-plans', icon: ClipboardCheck, color: 'blue', adminOnly: true },
      ]
    },
    {
      title: 'Digital Assets',
      items: [
        { name: 'จัดการ E-Catalog', path: '/ebook', icon: BookOpen, color: 'blue', adminOnly: true },
        { name: 'แกลเลอรีแผ่นไม้ R2', path: '/gallery-woodslabs', icon: Sparkles, color: 'purple', adminOnly: true },
        { name: 'รูปภาพต้นฉบับ R2', path: '/gallery-original', icon: ImageIcon, color: 'blue', adminOnly: true },
        { name: 'คลังข้อมูล Cloud R2', path: '/gallery-cloudflare', icon: Cloud, color: 'blue', adminOnly: true },
        { name: 'แกลเลอรีลับห้ามใช้งาน', path: '/gallery', icon: ImagePlus, color: 'blue', adminOnly: true },
      ]
    },
    {
      title: 'Team Management',
      items: [
        { name: 'เพิ่มทีม', path: '/add-team', icon: UserPlus, color: 'blue', adminOnly: true },
        { name: 'เพิ่มโปรเจค xlsx & csv', path: '/upload', icon: HardDrive, color: 'blue', adminOnly: true },
      ]
    }
  ];

  return (
    <div className={`min-h-screen ${isPublicPage ? 'bg-[#0F0F11]' : 'bg-[#F8FAFC]'}`}>
      {isPublicPage ? (
        <div className="w-full min-h-screen">
          {children}
        </div>
      ) : (
        <div className="flex min-h-screen relative w-full overflow-x-hidden">
          
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className={`fixed top-4 left-4 z-40 p-3 bg-white border border-slate-200 rounded-2xl shadow-xl text-slate-600 hover:text-blue-600 transition-all active:scale-90 ${
              isSidebarOpen ? 'hidden' : 'block'
            }`}
          >
            <Menu size={22} />
          </button>

          <aside 
            className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 z-50 shadow-[10px_0_40px_rgba(0,0,0,0.04)] transition-transform duration-500 ease-in-out flex flex-col ${
              isSidebarOpen ? 'translate-x-0' : '-translate-x-full' 
            }`}
          >
            <div className="p-8 border-b border-slate-50 flex justify-between items-center shrink-0 bg-white">
              <div className="font-black text-2xl text-slate-900 flex items-center gap-3 tracking-tighter">
                <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl shadow-lg shadow-blue-100">
                  <ShoppingBag className="text-white" size={22} /> 
                </div>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">WALLCRAFT</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 px-5 flex flex-col gap-8 scrollbar-hide">
              {menuGroups.map((group, gIdx) => {
                // ซ่อนหัวข้อใหญ่ทั้งหมด ถ้าในกลุ่มนั้นไม่มีเมนูที่ user เข้าได้เลย
                const hasVisibleItems = group.items.some(item => !item.adminOnly || userRole === 'admin');
                if (!hasVisibleItems) return null;

                return (
                  <div key={gIdx} className="flex flex-col gap-1.5">
                    <div className="px-4 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                      {group.title}
                    </div>
                    {group.items.map((menu) => {
                      // เจาะลึกรายเมนู: ถ้าเมนูนี้สำหรับ Admin เท่านั้น แต่คนที่ดูอยู่เป็น User -> ไม่ต้องวาดเมนูนี้ออกมา
                      if (menu.adminOnly && userRole !== 'admin') return null;

                      const isActive = pathname === menu.path;
                      const Icon = menu.icon;
                      const isPurple = menu.color === 'purple';

                      return (
                        <Link 
                          key={menu.path}
                          href={menu.path} 
                          prefetch={false}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 font-bold text-sm border ${
                            isActive 
                              ? isPurple 
                                ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg scale-[1.02]'
                                : 'bg-blue-600 text-white border-blue-400 shadow-lg scale-[1.02]'
                              : isPurple
                                ? 'text-indigo-600 hover:bg-indigo-50 border-transparent'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600 border-transparent' 
                          }`}
                        >
                          <Icon size={18} className={isActive ? 'text-white' : isPurple ? 'text-indigo-500' : 'text-slate-400'} /> 
                          <span>{menu.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </nav>

            <div className="p-5 border-t border-slate-100 shrink-0">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl font-bold text-sm text-red-500 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 transition-all duration-300"
              >
                <LogOut size={18} />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </aside>

          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-md transition-opacity duration-500" 
              onClick={() => setIsSidebarOpen(false)}
            ></div>
          )}

          <main className="flex-1 min-w-0 flex flex-col w-full relative">
            <div className="flex-1 w-full p-4 pt-24 md:p-8 lg:p-10 mx-auto"> 
              {children}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
