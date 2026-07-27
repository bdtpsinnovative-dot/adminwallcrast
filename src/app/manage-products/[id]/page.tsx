'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Save, ArrowLeft, Image as ImageIcon, Box, Tag, Trash2, Plus } from 'lucide-react';

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // State สำหรับข้อมูลแม่ (Product)
  const [product, setProduct] = useState({
    name: '',
    collection: '',
    image_url: ''
  });

  // State สำหรับข้อมูลลูก (Variants)
  const [variants, setVariants] = useState<any[]>([]);

  useEffect(() => {
    if (productId) fetchProductData();
  }, [productId]);

  const fetchProductData = async () => {
    setIsLoading(true);
    // ดึงข้อมูลแม่พร้อมลูกในคำสั่งเดียว
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (*)
      `)
      .eq('id', productId)
      .single();

    if (error) {
      alert('ดึงข้อมูลไม่สำเร็จ: ' + error.message);
    } else if (data) {
      setProduct({
        name: data.name || '',
        collection: data.collection || '',
        image_url: data.image_url || ''
      });
      // เรียง variant ตาม ID หรือ SKU หน่อยจะได้ดูง่าย
      const sortedVariants = (data.product_variants || []).sort((a: any, b: any) => 
        (a.sku || '').localeCompare(b.sku || '')
      );
      setVariants(sortedVariants);
    }
    setIsLoading(false);
  };

  // จัดการพิมพ์แก้ข้อมูลแม่
  const handleProductChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProduct({ ...product, [e.target.name]: e.target.value });
  };

  // จัดการพิมพ์แก้ข้อมูลลูก (Variants) ในตาราง
  const handleVariantChange = (index: number, field: string, value: string) => {
    const newVariants = [...variants];
    newVariants[index][field] = value;
    setVariants(newVariants);
  };

  // จัดการลบข้อมูลลูก (Variant) รายชิ้น
  const handleDeleteVariant = async (index: number) => {
    const targetVariant = variants[index];
    const skuText = targetVariant?.sku ? `SKU: ${targetVariant.sku}` : `รายการที่ ${index + 1}`;
    
    if (!confirm(`⚠️ ยืนยันการลบตัวเลือกสินค้า (${skuText}) ใช่ไหมครับ?`)) {
      return;
    }

    // ถ้ามี id อยู่แล้ว ให้ทำการลบจาก Supabase
    if (targetVariant.id) {
      try {
        const { error } = await supabase
          .from('product_variants')
          .delete()
          .eq('id', targetVariant.id);

        if (error) {
          alert('❌ ลบตัวเลือกไม่สำเร็จ: ' + error.message);
          return;
        }
      } catch (err: any) {
        alert('❌ เกิดข้อผิดพลาดขณะลบ: ' + err.message);
        return;
      }
    }

    // ลบออกจาก State
    const updatedVariants = variants.filter((_, i) => i !== index);
    setVariants(updatedVariants);
  };

  // จัดการเพิ่มตัวเลือกใหม่ (Variant)
  const handleAddVariant = () => {
    const newVariant = {
      product_id: Number(productId) || productId,
      sku: '',
      pattern: '',
      price: 0,
      cost: 0,
      thickness_mm: 0,
      width_mm: 0,
      length_mm: 0,
      sqm_per_unit: 0,
      moq: '',
      variant_image: ''
    };
    setVariants([...variants, newVariant]);
  };

  // จัดการลบสินค้าหลักทั้งหมด
  const handleDeleteProduct = async () => {
    if (!confirm(`⚠️ ยืนยันการลบสินค้า "${product.name || productId}" และรายการตัวเลือกทั้งหมดใช่ไหมครับ?`)) {
      return;
    }

    const { error } = await supabase.from('products').delete().eq('id', productId);

    if (error) {
      alert('❌ ลบสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      alert('✅ ลบสินค้าสำเร็จ!');
      router.push('/manage-products');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. อัปเดตตารางแม่ (products)
      const { error: prodError } = await supabase
        .from('products')
        .update({
          name: product.name,
          collection: product.collection,
          image_url: product.image_url,
        })
        .eq('id', productId);

      if (prodError) throw prodError;

      // 2. อัปเดตตารางลูก (product_variants)
      if (variants.length > 0) {
        const { error: varError } = await supabase
          .from('product_variants')
          .upsert(variants, { onConflict: 'id' });

        if (varError) throw varError;
      }

      alert('✅ บันทึกการแก้ไขข้อมูลสำเร็จ!');
      fetchProductData(); // reload fresh data
    } catch (error: any) {
      console.error(error);
      alert('❌ เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 🌟 Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className="p-2.5 bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">แก้ไขข้อมูลสินค้า</h1>
              <p className="text-sm text-slate-500 mt-0.5">ID: <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{productId}</span></p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleDeleteProduct}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg border border-red-200 transition-colors"
              title="ลบสินค้านี้ทั้งหมด"
            >
              <Trash2 size={18} />
              ลบสินค้านี้
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <Save size={18} />}
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
            </button>
          </div>
        </div>

        {/* 🌟 Product Info (ตารางแม่) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Box size={20} className="text-blue-600" />
            ข้อมูลหลัก (Main Product)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">ชื่อสินค้า (Product Name)</label>
              <input 
                type="text" name="name" value={product.name} onChange={handleProductChange}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">คอลเลกชัน (Collection)</label>
              <input 
                type="text" name="collection" value={product.collection} onChange={handleProductChange}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">รูปภาพหลัก (Image URL)</label>
              <div className="flex gap-2">
                <input 
                  type="text" name="image_url" value={product.image_url} onChange={handleProductChange}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                />
                {product.image_url && (
                  <a href={product.image_url} target="_blank" rel="noreferrer" className="flex-shrink-0 p-2.5 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 text-slate-600 flex items-center justify-center">
                    <img src={product.image_url} alt="Main" className="w-6 h-6 object-cover rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 🌟 Variants Info (ตารางลูก) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Tag size={20} className="text-blue-600" />
              รายการตัวเลือกสินค้า (Variants)
              <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs ml-2">{variants.length} รายการ</span>
            </h2>
            <button
              type="button"
              onClick={handleAddVariant}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold rounded-lg border border-blue-200 transition-colors"
            >
              <Plus size={16} /> เพิ่มตัวเลือกสินค้า
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4 font-medium w-16 text-center">รูปภาพ</th>
                  <th className="py-3 px-4 font-medium">SKU</th>
                  <th className="py-3 px-4 font-medium">Pattern/Color</th>
                  <th className="py-3 px-4 font-medium">Price (฿)</th>
                  <th className="py-3 px-4 font-medium">Cost (฿)</th>
                  <th className="py-3 px-4 font-medium">Size (TxWxL) mm</th>
                  <th className="py-3 px-4 font-medium">SQM/Unit</th>
                  <th className="py-3 px-4 font-medium">MOQ</th>
                  <th className="py-3 px-4 font-medium">Image URL</th>
                  <th className="py-3 px-4 font-medium text-center w-16">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variants.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      ยังไม่มีรายการตัวเลือกสินค้า กดปุ่ม "+ เพิ่มตัวเลือกสินค้า" เพื่อเพิ่มได้
                    </td>
                  </tr>
                ) : (
                  variants.map((v, idx) => (
                    <tr key={v.id || `new-${idx}`} className="hover:bg-slate-50 transition-colors">
                      
                      {/* 📸 รูปภาพ Preview */}
                      <td className="p-2">
                        <div className="w-12 h-12 mx-auto rounded-lg border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center shadow-sm">
                          {v.variant_image ? (
                            <img 
                              src={v.variant_image} 
                              alt={v.sku || 'variant'} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                              }} 
                            />
                          ) : (
                            <ImageIcon size={18} className="text-slate-300" />
                          )}
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="p-2">
                        <input 
                          type="text" value={v.sku || ''} onChange={(e) => handleVariantChange(idx, 'sku', e.target.value)}
                          className="w-full min-w-[120px] px-3 py-1.5 border border-slate-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </td>
                      {/* Pattern/Color */}
                      <td className="p-2">
                        <input 
                          type="text" value={v.pattern || v.color || ''} onChange={(e) => handleVariantChange(idx, 'pattern', e.target.value)}
                          className="w-full min-w-[150px] px-3 py-1.5 border border-slate-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </td>
                      {/* Price */}
                      <td className="p-2">
                        <input 
                          type="number" value={v.price || ''} onChange={(e) => handleVariantChange(idx, 'price', e.target.value)}
                          className="w-full min-w-[100px] px-3 py-1.5 border border-slate-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-right font-medium text-blue-700 bg-blue-50/50"
                        />
                      </td>
                      {/* Cost */}
                      <td className="p-2">
                        <input 
                          type="number" value={v.cost || ''} onChange={(e) => handleVariantChange(idx, 'cost', e.target.value)}
                          className="w-full min-w-[100px] px-3 py-1.5 border border-slate-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-right text-red-700 bg-red-50/50"
                        />
                      </td>
                      {/* Size: T / W / L */}
                      <td className="p-2 flex gap-1 min-w-[200px]">
                        <input 
                          type="number" placeholder="T" value={v.thickness_mm || ''} onChange={(e) => handleVariantChange(idx, 'thickness_mm', e.target.value)}
                          className="w-1/3 px-2 py-1.5 border border-slate-200 rounded focus:border-blue-500 outline-none text-center" title="Thickness"
                        />
                        <input 
                          type="number" placeholder="W" value={v.width_mm || ''} onChange={(e) => handleVariantChange(idx, 'width_mm', e.target.value)}
                          className="w-1/3 px-2 py-1.5 border border-slate-200 rounded focus:border-blue-500 outline-none text-center" title="Width"
                        />
                        <input 
                          type="number" placeholder="L" value={v.length_mm || ''} onChange={(e) => handleVariantChange(idx, 'length_mm', e.target.value)}
                          className="w-1/3 px-2 py-1.5 border border-slate-200 rounded focus:border-blue-500 outline-none text-center" title="Length"
                        />
                      </td>
                      {/* SQM */}
                      <td className="p-2">
                        <input 
                          type="number" step="0.01" value={v.sqm_per_unit || ''} onChange={(e) => handleVariantChange(idx, 'sqm_per_unit', e.target.value)}
                          className="w-full min-w-[80px] px-3 py-1.5 border border-slate-200 rounded focus:border-blue-500 outline-none text-center"
                        />
                      </td>
                      {/* MOQ */}
                      <td className="p-2">
                        <input 
                          type="text" value={v.moq || ''} onChange={(e) => handleVariantChange(idx, 'moq', e.target.value)}
                          className="w-full min-w-[100px] px-3 py-1.5 border border-slate-200 rounded focus:border-blue-500 outline-none"
                        />
                      </td>
                      {/* Image URL */}
                      <td className="p-2">
                        <input 
                          type="text" value={v.variant_image || ''} onChange={(e) => handleVariantChange(idx, 'variant_image', e.target.value)}
                          className="w-full min-w-[200px] px-3 py-1.5 border border-slate-200 rounded focus:border-blue-500 outline-none text-xs text-slate-500"
                          placeholder="https://..."
                        />
                      </td>
                      {/* ปุ่มลบ Variant รายชิ้น */}
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteVariant(idx)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบตัวเลือกนี้"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
             <span>* สามารถพิมพ์แก้ไขข้อมูลในช่องตารางได้โดยตรง, กดลบรายชิ้นที่คอลัมน์ "จัดการ" หรือกด "+ เพิ่มตัวเลือกสินค้า" ได้</span>
          </div>
        </div>

      </div>
    </div>
  );
}