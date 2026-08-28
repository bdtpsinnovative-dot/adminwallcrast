import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  const pathname = request.nextUrl.pathname;

  // 1. หน้าที่ "ทุกคน" เข้าได้ (ไม่มี Token ก็เข้าได้, มี Token ก็เข้าได้)
  const isCatalogPage = pathname.startsWith('/catalog');
  const isApiRoute = pathname.startsWith('/api');

  // 2. หน้าที่สงวนไว้ให้ "คนที่ยังไม่ล็อกอิน" เท่านั้น (เช่น หน้า Login)
  const isGuestOnlyPage = pathname === '/' || pathname.startsWith('/login');

  // ถ้าเป็นหน้า Catalog หรือ API ปล่อยผ่านเลย ไม่ต้องเช็คอะไรเพิ่ม
  if (isCatalogPage || isApiRoute) {
    return NextResponse.next();
  }

  // 3. ถ้าไม่มี Token และพยายามเข้าหน้าหลังบ้าน -> เตะไปหน้า Login
  if (!token && !isGuestOnlyPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 4. ถ้ามี Token (ล็อกอินแล้ว) แต่พยายามเข้าหน้า Login -> ดันไป Dashboard
  if (token && isGuestOnlyPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // matcher จะละเว้นไฟล์ระบบ รูปภาพ และไฟล์ที่มีนามสกุล (.css, .js ฯลฯ)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
