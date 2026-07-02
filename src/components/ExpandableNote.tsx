'use client';

import { useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

export default function ExpandableNote({ note }: { note: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // ถ้าข้อความสั้นกว่า 100 ตัวอักษร ก็ไม่ต้องโชว์ปุ่มดูเพิ่มเติม
  const isLongText = note.length > 100; 
  const displayText = (!isExpanded && isLongText) ? note.slice(0, 100) + '...' : note;

  return (
    <div className="mb-4 bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm transition-all duration-300">
      <p className="font-bold text-yellow-800 mb-1 flex items-center gap-1">
        <FileText size={14} /> หมายเหตุ (Note):
      </p>
      
      <p className="text-yellow-700 whitespace-pre-wrap leading-relaxed">
        {displayText}
      </p>
      
      {isLongText && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-yellow-600 hover:text-yellow-900 text-xs font-black mt-2 flex items-center gap-1 transition-colors"
        >
          {isExpanded ? (
            <><ChevronUp size={14} /> ย่อข้อความ</>
          ) : (
            <><ChevronDown size={14} /> ดูเพิ่มเติม</>
          )}
        </button>
      )}
    </div>
  );
}