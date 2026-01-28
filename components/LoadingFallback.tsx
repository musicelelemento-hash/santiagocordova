
import React from 'react';
import { RefreshCw } from 'lucide-react';

export const LoadingFallback: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full min-h-[50vh] animate-fade-in p-8">
        <div className="w-full max-w-4xl space-y-6">
            {/* Header Skeleton */}
            <div className="flex justify-between items-center mb-8">
                <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
            </div>

            {/* Content Skeleton Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
                <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
                <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
            </div>

            {/* Table/List Skeleton */}
            <div className="mt-8 space-y-4">
                <div className="h-12 w-full bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                <div className="h-12 w-full bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                <div className="h-12 w-full bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            </div>
            
            <div className="flex justify-center mt-8 text-slate-400 text-sm items-center gap-2">
                <RefreshCw size={16} className="animate-spin"/>
                <span>Cargando módulo...</span>
            </div>
        </div>
    </div>
  );
};
