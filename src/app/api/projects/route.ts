import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบใหม่' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const token = authorization.slice('Bearer '.length);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }, { status: 401 });
    }

    const body = await request.json();
    const projectName = typeof body.project_name === 'string' ? body.project_name.trim() : '';
    if (!projectName) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อโปรเจกต์' }, { status: 400 });
    }

    // ชื่อเดิมให้เลือกใช้รายการเดิม แทนที่จะตอบ error ที่ผู้ใช้แก้ไม่ได้
    const { data: existing, error: lookupError } = await supabase
      .from('projects')
      .select('id, project_name')
      .ilike('project_name', projectName)
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return NextResponse.json({ project: existing, existed: true });

    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({ project_name: projectName })
      .select('id, project_name')
      .single();
    if (insertError) throw insertError;

    return NextResponse.json({ project, existed: false }, { status: 201 });
  } catch (error: any) {
    console.error('[Projects][POST] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'เพิ่มโปรเจกต์ไม่สำเร็จ' },
      { status: 500 },
    );
  }
}
