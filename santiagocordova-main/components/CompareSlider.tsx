
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

interface CompareSliderProps {
  beforeImage: string;
  afterImage: string;
  className?: string;
}

export const CompareSlider: React.FC<CompareSliderProps> = ({ beforeImage, afterImage, className }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
      setSliderPosition(percent);
    }
  }, []);

  const onMouseDown = () => setIsDragging(true);
  const onTouchStart = () => setIsDragging(true);

  const onMouseUp = () => setIsDragging(false);
  const onTouchEnd = () => setIsDragging(false);

  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (isDragging) handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleGlobalUp = () => setIsDragging(false);
    const handleGlobalMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e.clientX);
    };

    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('mousemove', handleGlobalMove);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('mousemove', handleGlobalMove);
    };
  }, [isDragging, handleMove]);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none cursor-ew-resize group rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 ${className}`}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* After Image (Bottom Layer) - The New Design */}
      <img 
        src={afterImage} 
        alt="After" 
        className="absolute top-0 left-0 w-full h-full object-cover"
      />
      <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm z-10">
        Propuesta IA
      </div>

      {/* Before Image (Top Layer, Clipped) - The Original */}
      <div 
        className="absolute top-0 left-0 w-full h-full overflow-hidden border-r-2 border-white"
        style={{ width: `${sliderPosition}%` }}
      >
        <img 
          src={beforeImage} 
          alt="Before" 
          className="absolute top-0 left-0 max-w-none h-full object-cover"
          style={{ width: containerRef.current?.offsetWidth || '100%' }} 
        />
        <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
            Original
        </div>
      </div>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize shadow-[0_0_20px_rgba(0,0,0,0.5)] z-20 flex items-center justify-center"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-slate-900 -ml-0.5">
          <ChevronsLeftRight size={16} />
        </div>
      </div>
    </div>
  );
};
