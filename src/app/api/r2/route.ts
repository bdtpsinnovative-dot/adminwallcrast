// src/app/api/r2/route.ts
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectsCommand, _Object } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '40');
    const offset = parseInt(searchParams.get('offset') || '0');
    const folder = searchParams.get('folder') || 'master_assets'; 
    const over1MB = searchParams.get('over1MB') === 'true';

    // 🌟 ระบุ Type ให้ชัดเจนเพื่อป้องกัน Build Error
    let allFiles: _Object[] = []; 
    let isTruncated: boolean = true;
    let continuationToken: string | undefined = undefined;

    while (isTruncated) {
      // 🌟 ใส่ Type ให้ command ชัดๆ ว่าคือ ListObjectsV2Command
      const command: ListObjectsV2Command = new ListObjectsV2Command({ 
        Bucket: BUCKET_NAME,
        Prefix: `${folder}/`,
        ContinuationToken: continuationToken
      });
      
      const response = await s3Client.send(command);
      
      if (response.Contents) {
        allFiles.push(...response.Contents);
      }
      
      isTruncated = response.IsTruncated ?? false;
      continuationToken = response.NextContinuationToken;
    }

    let files = allFiles.filter(file => file.Key !== `${folder}/`);
    
    if (over1MB) {
      files = files.filter(file => (file.Size ?? 0) > 1024 * 1024);
    }

    files.sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));

    const paginatedFiles = files.slice(offset, offset + limit);

    const images = paginatedFiles.map(file => {
      const cleanName = file.Key?.replace(`${folder}/`, '') || '';
      return {
        name: cleanName,
        url: `${PUBLIC_URL}/${file.Key}`,
        updatedAt: file.LastModified?.getTime() || Date.now(),
        size: file.Size ?? 0
      };
    });

    return NextResponse.json({ images, totalCount: files.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ฟังก์ชัน POST และ DELETE คงเดิมครับ (มันผ่านอยู่แล้ว)
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;
    const folder = formData.get('folder') as string || 'master_assets'; 
    if (!file || !fileName) return NextResponse.json({ error: "Missing file or filename" }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${folder}/${fileName}`,
      Body: buffer,
      ContentType: file.type,
    });
    await s3Client.send(command);
    return NextResponse.json({ success: true, url: `${PUBLIC_URL}/${folder}/${fileName}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { fileNames, folder = 'master_assets' } = await request.json(); 
    if (!fileNames || !Array.isArray(fileNames)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const command = new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: { Objects: fileNames.map(name => ({ Key: `${folder}/${name}` })) }
    });
    await s3Client.send(command);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}