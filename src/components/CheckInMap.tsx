'use client';

import React, { useState } from 'react';
import { Map, MapPin, Maximize2, X, FileText } from 'lucide-react';

interface CheckInMapProps {
  lat?: number;
  lng?: number;
  isCsv?: boolean;
}

export default function CheckInMap({ lat, lng, isCsv }: CheckInMapProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isModalMapLoading, setIsModalMapLoading] = useState(true);

  if (isCsv) {
    return (
      <div className="w-full h-full min-h-[220px] rounded-md bg-slate-50 border-[2px] border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
        <FileText size={24} className="mb-2 text-slate-300" />
        <span className="text-xs font-semibold text-slate-500">ข้อมูลนำเข้าจากไฟล์</span>
      </div>
    );
  }

  if (!lat || !lng) {
    return (
      <div className="w-full h-full min-h-[220px] rounded-md bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center text-slate-400">
        <MapPin size={24} className="mb-2 opacity-40" />
        <span className="text-xs font-medium">ไม่มีแผนที่</span>
      </div>
    );
  }

  const mapUrl = `https://maps.google.com/maps?q=${lat},${lng}&hl=th&z=15&output=embed`;

  return (
    <>
      <div className="relative w-full h-full min-h-[220px] rounded-md overflow-hidden border border-slate-200 shadow-sm group bg-slate-50">
        {/* Loading Spinner */}
        {isMapLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin mb-2"></div>
            <span className="text-xs font-medium text-slate-500">กำลังโหลดแผนที่...</span>
          </div>
        )}

        {/* Small preview map (non-interactive to prevent accidental scrolls) */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${isMapLoading ? 'opacity-0' : 'opacity-80 group-hover:opacity-100'}`}>
          <iframe
            width="100%"
            height="100%"
            frameBorder="0"
            style={{ border: 0 }}
            src={mapUrl}
            tabIndex={-1}
            onLoad={() => setIsMapLoading(false)}
          />
        </div>
        
        {/* Overlay button */}
        {!isMapLoading && (
          <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => {
                setIsModalMapLoading(true);
                setIsModalOpen(true);
              }}
              className="bg-white text-slate-700 hover:text-indigo-600 font-bold text-xs px-3 py-1.5 rounded-md shadow-md flex items-center gap-1.5 transition-colors border border-slate-200"
            >
              <Maximize2 size={14} />
              ขยายแผนที่
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <Map size={16} className="text-slate-500" />
                ตำแหน่งพิกัด: {lat.toFixed(5)}, {lng.toFixed(5)}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 p-1.5 rounded-md transition-colors border border-slate-200 shadow-sm"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 w-full bg-slate-100 relative">
              {isModalMapLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50 z-10">
                  <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
                  <span className="text-sm font-medium text-slate-500">กำลังโหลดแผนที่...</span>
                </div>
              )}
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={mapUrl}
                allowFullScreen
                onLoad={() => setIsModalMapLoading(false)}
                className={isModalMapLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
