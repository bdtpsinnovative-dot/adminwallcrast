'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { saveAdminTokenCookie } from '@/lib/admin-auth-cookie';
import { Mail, LockKeyhole, Loader2, ArrowRight, Leaf, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (active && session?.access_token) {
        saveAdminTokenCookie(session.access_token);
        router.replace('/dashboard');
      }
    };

    void restoreSession();
    return () => {
      active = false;
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      // 🌟 แก้ไขตรงนี้: เอาเงื่อนไขที่บล็อก user ทั่วไปออก ปล่อยให้ผ่านไปเซฟ Cookie ได้เลย
      if (profileError) {
        await supabase.auth.signOut();
        throw new Error('เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์');
      }

      // เซฟ token ให้ Server Component เช็กสิทธิ์ได้ และจะถูกต่ออายุจาก
      // RootLayoutClient ทุกครั้งที่ Supabase refresh session.
      saveAdminTokenCookie(authData.session.access_token);

      // ส่งทุกคนไปที่หน้า Dashboard (เพราะเราเขียนดักสิทธิ์ God Mode / Team Mode ไว้ที่หน้า Dashboard แล้ว)
      router.push('/dashboard'); 
      router.refresh();

    } catch (err: any) {
      setError(err.message);
      setIsLoading(false); // 🌟 ย้ายการปิด Loading มาไว้ใน catch
    } 
    // 🌟 เอา finally { setIsLoading(false) } ออก 
    // เพราะถ้าล็อกอินผ่าน เราอยากให้มันโหลดค้างไว้จนกว่าจะเปลี่ยนหน้าเสร็จ ผู้ใช้จะได้ไม่เห็นจอกระพริบ
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 md:p-6 font-sans relative bg-[#0A0705] overflow-hidden">
      
      {/* 🌟 CSS แอนิเมชัน */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes breathing-glow {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
          50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.7; }
        }
        @keyframes float-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-glow {
          animation: breathing-glow 8s ease-in-out infinite;
        }
        .animate-float {
          animation: float-subtle 6s ease-in-out infinite;
        }
      `}} />

      {/* --- 🪵 Background --- */}
      <div 
        className="absolute inset-0 z-0 opacity-40"
        style={{
          backgroundImage: 'url("https://i.pinimg.com/736x/cb/1f/17/cb1f17b6497222e875f2108d91d0179b.jpg?q=80&w=2000&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      ></div>

      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0A0705_100%)] opacity-90"></div>

      {/* --- ✨ แสง Ambient --- */}
      <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-[#D4A373]/30 rounded-full blur-[120px] animate-glow z-0 pointer-events-none"></div>

      {/* --- 🔐 Form การ์ดล็อกอิน --- */}
      <div className="w-full max-w-[400px] relative z-10 animate-float">
        <div className="bg-[#1A120B]/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] relative overflow-hidden">
          
          {/* 🌟 LOADING OVERLAY: บังหน้าจอตอนกำลังล็อกอินให้รู้ตัว 100% */}
          {isLoading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#1A120B]/80 backdrop-blur-md rounded-3xl transition-all duration-300">
              <Loader2 className="animate-spin text-[#D4A373] mb-4" size={48} strokeWidth={1.5} />
              <p className="text-[#D4A373] font-bold tracking-widest text-sm animate-pulse uppercase">Authenticating...</p>
              <p className="text-white/40 text-[10px] mt-2">กำลังเชื่อมต่อกับระบบหลังบ้าน</p>
            </div>
          )}

          <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 blur-[50px] rounded-full pointer-events-none"></div>

          {/* Header */}
          <div className="text-center mb-10 relative z-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10 shadow-inner mb-6">
              <Leaf className="text-[#D4A373]" size={28} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight mb-2">
              Wall<span className="font-bold text-[#D4A373]">Craft</span>
            </h1>
            <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest">
              Admin Control Panel
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 backdrop-blur-md relative z-10">
              <ShieldCheck className="text-red-400 shrink-0" size={18} />
              <p className="text-red-300 text-xs font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5 relative z-10">
            <div>
              <label className="block text-white/50 text-[10px] font-bold mb-2 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/30 group-focus-within:text-[#D4A373] transition-colors">
                  <Mail size={18} strokeWidth={1.5} />
                </div>
                <input
                  type="email"
                  required
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 text-white rounded-2xl py-3.5 pl-11 pr-5 outline-none focus:bg-black/60 focus:border-[#D4A373]/50 focus:ring-4 focus:ring-[#D4A373]/10 transition-all text-sm font-medium placeholder:text-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="admin@wallcraft.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-white/50 text-[10px] font-bold mb-2 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/30 group-focus-within:text-[#D4A373] transition-colors">
                  <LockKeyhole size={18} strokeWidth={1.5} />
                </div>
                <input
                  type="password"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 text-white rounded-2xl py-3.5 pl-11 pr-5 outline-none focus:bg-black/60 focus:border-[#D4A373]/50 focus:ring-4 focus:ring-[#D4A373]/10 transition-all text-sm font-medium placeholder:text-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white text-black hover:bg-[#D4A373] hover:text-white font-bold text-sm py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg disabled:opacity-0 mt-8 group relative overflow-hidden"
            >
              Sign In
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center text-white/20 text-[10px] font-medium uppercase tracking-[0.2em]">
          Secure Connection &copy; 2026
        </div>
      </div>

    </main>
  );
}
