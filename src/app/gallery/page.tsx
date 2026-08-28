'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Cropper from 'react-easy-crop';
import { 
  ImagePlus, UploadCloud, Copy, X, CheckCircle2, 
  Loader2, ArrowLeft, Image as ImageIcon, Trash2, CheckSquare, Square, Crop, RefreshCcw
} from 'lucide-react';

const BUCKET_NAME = 'product-gallery';
const PAGE_SIZE = 40; 

interface GalleryImage {
  name: string;
  url: string;
  updatedAt: number; // 🌟 เอาไว้แก้ปัญหา Cache ของ Browser
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); 
    image.src = url;
  });

const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('No 2d context');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Canvas is empty'));
      resolve(blob);
    }, 'image/jpeg', 1); 
  });
};

export default function ImageGalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Modal & Upload State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'cropping' | 'compressing' | 'uploading'>('idle');
  
  // 🌟 State สำหรับจดจำว่า "กำลังจะเอาไปทับไฟล์ไหน"
  const [replaceFileName, setReplaceFileName] = useState<string | null>(null);
  
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchImages(false); 
  }, []);

  const fetchImages = async (isLoadMore = false) => {
    if (isLoadMore) setIsLoadingMore(true);
    else { setIsLoading(true); setOffset(0); }

    const currentOffset = isLoadMore ? offset : 0;

    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list('', { 
          limit: PAGE_SIZE, 
          offset: currentOffset,
          sortBy: { column: 'created_at', order: 'desc' } 
        });

      if (error) throw error;

      if (data) {
        if (data.length < PAGE_SIZE) setHasMore(false);
        else setHasMore(true);

        const validFiles = data.filter(file => file.name !== '.emptyFolderPlaceholder');
        const imageList = validFiles.map(file => {
          const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(file.name);
          return { 
            name: file.name, 
            url: publicUrlData.publicUrl,
            updatedAt: new Date(file.updated_at || Date.now()).getTime() // ดึงเวลาอัปเดตล่าสุดมาทำ Cache Buster
          };
        });

        if (isLoadMore) setImages(prev => [...prev, ...imageList]);
        else setImages(imageList);
        
        setOffset(currentOffset + data.length);
      }
    } catch (error: any) {
      console.error(error);
      alert('ดึงรูปภาพไม่สำเร็จ: ' + error.message);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleDeleteImages = async (fileNames: string[]) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะลบรูปภาพ ${fileNames.length} รายการนี้?`)) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.storage.from(BUCKET_NAME).remove(fileNames);
      if (error) throw error;

      setImages(prev => prev.filter(img => !fileNames.includes(img.name)));
      setSelectedImages([]); 
      showToast(`✅ ลบรูปภาพ ${fileNames.length} รายการเรียบร้อย!`);
      setOffset(prev => Math.max(0, prev - fileNames.length));
    } catch (error: any) {
      alert('ลบรูปภาพไม่สำเร็จ: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelection = (fileName: string) => {
    setSelectedImages(prev => 
      prev.includes(fileName) ? prev.filter(name => name !== fileName) : [...prev, fileName]
    );
  };

  // 🚀 กดปุ่มแทนที่รูปภาพ
  const handleReplaceClick = (fileName: string) => {
    setReplaceFileName(fileName);
    setIsModalOpen(true);
  };

  const onFileSelect = async (file: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setUploadStatus('cropping');
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    
    setUploadStatus('compressing');
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], "cropped.jpg", { type: "image/jpeg" });
      await handleUpload(croppedFile);
    } catch (e) {
      console.error(e);
      alert("เกิดข้อผิดพลาดในการตัดรูปภาพ");
      setUploadStatus('idle');
    }
  };

  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.src = URL.createObjectURL(file);
      
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1920; 
        
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) { height *= MAX_SIZE / width; width = MAX_SIZE; } 
          else { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Cannot get canvas context"));
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.9;
        let blob: Blob | null = null;
        const tryCompress = async (q: number): Promise<Blob> => new Promise((r) => canvas.toBlob((b) => r(b!), 'image/webp', q));

        do {
          blob = await tryCompress(quality);
          if (blob.size > 1024 * 1024) quality -= 0.1;
          else break;
        } while (quality > 0.1);

        resolve(blob);
      };
      img.onerror = reject;
    });
  };

  const handleUpload = async (file: File) => {
    try {
      const compressedBlob = await compressImage(file);
      
      // 🌟 พระเอกอยู่ตรงนี้: ถ้ากำลังแทนที่ให้ใช้ชื่อเดิมเป๊ะๆ ถ้าอัปใหม่ให้สุ่มชื่อใหม่
      const fileName = replaceFileName || `${Date.now()}-${Math.floor(Math.random() * 1000)}.webp`;

      setUploadStatus('uploading');

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, compressedBlob, { 
          contentType: 'image/webp',
          upsert: true // 🌟 KEY สำคัญ: อนุญาตให้เขียนทับไฟล์เดิมได้ (URL จะคงเดิม)
        });

      if (error) throw error;

      closeModal();
      showToast(replaceFileName ? '✅ แทนที่รูปภาพเรียบร้อย (URL เดิม)' : '✅ อัปโหลดรูปภาพใหม่เรียบร้อย!');
      fetchImages(false); 

    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
      setUploadStatus('idle');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setUploadStatus('idle');
    setImageSrc(null);
    setReplaceFileName(null); // เคลียร์สถานะการแทนที่
    if (imageSrc) URL.revokeObjectURL(imageSrc); 
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast('📋 คัดลอก URL เรียบร้อยแล้ว!'));
  };

  const copySelectedLinks = () => {
    if (selectedImages.length === 0) return;

    const selectedUrls = selectedImages
      .map(name => {
        const found = images.find(img => img.name === name);
        return found ? found.url : null;
      })
      .filter(Boolean);

    if (selectedUrls.length === 0) return;

    const textToCopy = selectedUrls.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast(`📋 คัดลอก ${selectedUrls.length} ลิงก์เรียบร้อยแล้ว (พร้อมวางลงในชีท)!`);
    }).catch(err => {
      console.error(err);
      alert('คัดลอกไม่สำเร็จ: ' + err.message);
    });
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-8 font-sans relative pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <ImagePlus size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">คลังรูปสินค้า (Gallery)</h1>
              <p className="text-sm text-slate-500 mt-0.5">ระบบจะบังคับครอปจัตุรัสและบีบอัดเป็น WebP (ต่ำกว่า 1MB)</p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Link 
              href="/manage-products" 
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
            >
              <ArrowLeft size={16} /> กลับ
            </Link>
            <button 
              onClick={() => { setReplaceFileName(null); setIsModalOpen(true); }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <UploadCloud size={18} /> อัปโหลดรูปใหม่
            </button>
          </div>
        </div>

        {selectedImages.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-wrap justify-between items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-blue-900 font-bold">
                เลือกแล้ว {selectedImages.length} รูป
              </span>
              <button 
                onClick={() => {
                  const allVisibleNames = images.map(img => img.name);
                  const isAllSelected = allVisibleNames.every(name => selectedImages.includes(name));
                  if (isAllSelected) {
                    setSelectedImages([]);
                  } else {
                    setSelectedImages(allVisibleNames);
                  }
                }}
                className="text-xs font-semibold text-blue-800 hover:text-blue-950 bg-blue-200/80 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                {images.length > 0 && images.every(img => selectedImages.includes(img.name)) ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมดในหน้านี้'}
              </button>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <button 
                onClick={copySelectedLinks}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm cursor-pointer"
                title="คัดลอกทุกลิงก์ที่เลือก นำไปวางใน Google Sheet / Excel จะเรียงแยกบรรทัดให้อัตโนมัติ"
              >
                <Copy size={16} />
                คัดลอก {selectedImages.length} ลิงก์ (วางลงชีท)
              </button>

              <button 
                onClick={() => setSelectedImages([])}
                className="px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                onClick={() => handleDeleteImages(selectedImages)}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                ลบที่เลือก
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="animate-spin text-blue-500" size={32} />
              <p>กำลังโหลดรูปภาพ...</p>
            </div>
          ) : images.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <ImageIcon size={48} className="opacity-20" />
              <p>ยังไม่มีรูปภาพในคลัง</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {images.map((img) => {
                  const isSelected = selectedImages.includes(img.name);
                  // 🌟 เพิ่ม ?v=timestamp เพื่อหลอกเบราว์เซอร์ให้ดึงรูปใหม่เสมอหลังกดอัปทับ
                  const imageUrlWithCacheBuster = `${img.url}?v=${img.updatedAt}`;

                  return (
                    <div 
                      key={img.name} 
                      className={`group bg-white border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col relative ${
                        isSelected ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <button
                        onClick={() => toggleSelection(img.name)}
                        className={`absolute top-2 left-2 z-10 p-1.5 rounded-lg transition-all ${
                          isSelected ? 'bg-blue-500 text-white opacity-100' : 'bg-white/80 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-blue-500'
                        }`}
                      >
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                      </button>

                      {/* 🌟 ปุ่มแก้ไข (แทนที่รูป) */}
                      <button
                        onClick={() => handleReplaceClick(img.name)}
                        className="absolute top-2 right-10 z-10 p-1.5 bg-white/80 text-blue-500 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm"
                        title="อัปโหลดรูปทับไฟล์นี้"
                      >
                        <RefreshCcw size={18} />
                      </button>

                      <button
                        onClick={() => handleDeleteImages([img.name])}
                        disabled={isDeleting}
                        className="absolute top-2 right-2 z-10 p-1.5 bg-white/80 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all shadow-sm"
                        title="ลบรูปนี้"
                      >
                        <Trash2 size={18} />
                      </button>

                      <div 
                        className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center p-2 cursor-pointer"
                        onClick={() => toggleSelection(img.name)} 
                      >
                        <img 
                          src={imageUrlWithCacheBuster} 
                          alt={img.name} 
                          loading="lazy" 
                          className={`max-w-full max-h-full object-contain transition-transform duration-500 ${isSelected ? 'scale-95' : 'group-hover:scale-105'}`}
                        />
                      </div>

                      <div className="p-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-white">
                        <span className="text-xs text-slate-500 truncate" title={img.name}>{img.name}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(img.url); }} // URL เพียวๆ ไม่มี ?v= ตอนก๊อปปี้ไปวางในชีท
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors shrink-0"
                          title="คัดลอก URL"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasMore && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => fetchImages(true)}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-full hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm disabled:opacity-70"
                  >
                    {isLoadingMore ? <><Loader2 size={18} className="animate-spin" /> กำลังโหลดเพิ่ม...</> : 'โหลดรูปเพิ่ม'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 🌟 Modal: Upload & Crop */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {uploadStatus === 'cropping' ? <Crop className="text-blue-600" size={20} /> : <UploadCloud className="text-blue-600" size={20} />}
                {uploadStatus === 'cropping' ? 'ปรับขนาดรูปภาพ (1:1)' : replaceFileName ? 'แทนที่รูปภาพเดิม (URL เดิม)' : 'อัปโหลดรูปภาพใหม่'}
              </h2>
              <button 
                onClick={closeModal}
                disabled={uploadStatus === 'compressing' || uploadStatus === 'uploading'}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {uploadStatus === 'idle' && (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault(); setIsDragging(false);
                    if (e.dataTransfer.files?.length > 0) onFileSelect(e.dataTransfer.files[0]);
                  }}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                    isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                  }`}
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={(e) => { if (e.target.files?.[0]) onFileSelect(e.target.files[0]); }}
                    className="hidden" 
                  />
                  <ImageIcon size={48} className="mx-auto text-slate-300 mb-3" />
                  <p className="font-medium text-slate-700">คลิก หรือ ลากไฟล์มาวางที่นี่</p>
                  {replaceFileName ? (
                    <p className="text-xs text-orange-500 mt-2">⚠️ ไฟล์เดิมจะถูกเขียนทับทันที แต่ URL ใน Google Sheets จะยังใช้ได้เหมือนเดิม</p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">(รูปจะถูกบังคับครอปเป็นจัตุรัสก่อนอัปโหลด)</p>
                  )}
                </div>
              )}

              {uploadStatus === 'cropping' && imageSrc && (
                <div className="flex flex-col gap-4">
                  <div className="relative w-full h-80 bg-slate-900 rounded-xl overflow-hidden">
                    <Cropper
                      image={imageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={1} 
                      onCropChange={setCrop}
                      onCropComplete={onCropComplete}
                      onZoomChange={setZoom}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">ซูม:</span>
                    <input
                      type="range"
                      value={zoom}
                      min={1}
                      max={3}
                      step={0.1}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                  <div className="flex justify-end gap-3 mt-2">
                    <button 
                      onClick={() => { setUploadStatus('idle'); setImageSrc(null); }}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button 
                      onClick={handleCropConfirm}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                    >
                      ยืนยันและอัปโหลด
                    </button>
                  </div>
                </div>
              )}

              {(uploadStatus === 'compressing' || uploadStatus === 'uploading') && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <Loader2 className="animate-spin text-blue-600" size={40} />
                  <div>
                    <p className="font-semibold text-slate-700">
                      {uploadStatus === 'compressing' ? 'กำลังบีบอัดภาพ (WebP)...' : 'กำลังอัปโหลดขึ้นเซิร์ฟเวอร์...'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">กรุณารอสักครู่ ห้ามปิดหน้าต่างนี้</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Toast */}
      <div className={`fixed bottom-6 right-6 flex items-center gap-2 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-xl transition-all duration-300 z-50 ${
        toastMsg ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'
      }`}>
        <CheckCircle2 size={20} className="text-emerald-400" />
        <span className="text-sm font-medium">{toastMsg}</span>
      </div>

    </div>
  );
}