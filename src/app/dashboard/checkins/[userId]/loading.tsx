export default function Loading() {
  return (
    <main className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      <div className="mb-6 max-w-[1600px] w-[96%] mx-auto">
        {/* Back Link Skeleton */}
        <div className="w-32 h-5 bg-slate-200 rounded animate-pulse mb-4"></div>

        {/* Header Card Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md bg-slate-200 animate-pulse shrink-0"></div>
            <div className="space-y-2">
              <div className="w-48 h-6 bg-slate-200 rounded animate-pulse"></div>
              <div className="w-32 h-4 bg-slate-200 rounded animate-pulse"></div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200 overflow-x-auto shrink-0">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex flex-col items-center px-4 ${i !== 4 ? 'border-r border-slate-200' : ''} min-w-[80px]`}>
                <div className="w-12 h-3 bg-slate-200 rounded animate-pulse mb-2"></div>
                <div className="w-8 h-6 bg-slate-300 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] w-[96%] mx-auto">
        {/* Filters and Buttons Skeleton */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex-1 w-full flex flex-wrap gap-2">
             <div className="w-32 h-9 bg-slate-200 rounded-md animate-pulse"></div>
             <div className="w-32 h-9 bg-slate-200 rounded-md animate-pulse"></div>
             <div className="w-32 h-9 bg-slate-200 rounded-md animate-pulse"></div>
          </div>
          <div className="w-28 h-9 bg-slate-200 rounded-md animate-pulse"></div>
        </div>

        {/* Check-in Cards Skeleton */}
        <div className="space-y-4 mt-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              {/* Card Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-28 h-5 bg-slate-200 rounded-md animate-pulse"></div>
                  <div className="w-32 h-5 bg-slate-200 rounded-md animate-pulse"></div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="w-24 h-4 bg-slate-200 rounded animate-pulse"></div>
                  <div className="w-20 h-4 bg-slate-200 rounded animate-pulse"></div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 md:p-8">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                  {/* Info Column */}
                  <div className="col-span-1 xl:col-span-4 flex flex-col space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-slate-200 rounded-sm animate-pulse shrink-0"></div>
                      <div className="space-y-2 w-full">
                        <div className="w-3/4 h-5 bg-slate-200 rounded animate-pulse"></div>
                        <div className="w-1/2 h-4 bg-slate-200 rounded animate-pulse"></div>
                      </div>
                    </div>
                    <div className="w-32 h-6 bg-slate-100 rounded-md animate-pulse"></div>
                    <div className="w-full h-24 bg-slate-50 border border-slate-100 rounded-md animate-pulse"></div>
                  </div>

                  {/* Map Column */}
                  <div className="col-span-1 xl:col-span-5">
                    <div className="w-24 h-4 bg-slate-200 rounded animate-pulse mb-3"></div>
                    <div className="w-full h-48 xl:h-full min-h-[220px] rounded-md bg-slate-100 animate-pulse"></div>
                  </div>

                  {/* Images Column */}
                  <div className="col-span-1 xl:col-span-3 flex flex-col">
                    <div className="w-24 h-4 bg-slate-200 rounded animate-pulse mb-3"></div>
                    <div className="flex-1 min-h-[220px] bg-slate-100 rounded-md animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
