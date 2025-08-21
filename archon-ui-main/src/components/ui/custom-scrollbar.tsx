import React, { useRef, useEffect, useState } from 'react';

interface CustomScrollbarProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

export const CustomScrollbar: React.FC<CustomScrollbarProps> = ({
  children,
  className = '',
  maxHeight = '200px'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollInfo, setScrollInfo] = useState({
    canScrollLeft: false,
    canScrollRight: false,
    scrollPercentage: 0,
    thumbWidth: 30
  });

  const updateScrollInfo = () => {
    if (!contentRef.current) return;

    const element = contentRef.current;
    const canScrollLeft = element.scrollLeft > 0;
    const canScrollRight = element.scrollLeft < (element.scrollWidth - element.clientWidth);
    const scrollPercentage = element.scrollWidth > element.clientWidth 
      ? element.scrollLeft / (element.scrollWidth - element.clientWidth) 
      : 0;
    
    // Calculate thumb width to roughly represent one project card width
    // Project cards are ~288px (18rem) + 16px gap = ~304px per card
    const cardWidth = 304; // Approximate width including gap
    const thumbWidth = element.scrollWidth > element.clientWidth
      ? Math.max(10, Math.min(25, (cardWidth / element.scrollWidth) * 100))
      : 20;

    setScrollInfo({ canScrollLeft, canScrollRight, scrollPercentage, thumbWidth });
  };

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    // Update scroll info on mount and resize
    updateScrollInfo();
    
    const resizeObserver = new ResizeObserver(updateScrollInfo);
    resizeObserver.observe(element);

    element.addEventListener('scroll', updateScrollInfo);

    return () => {
      element.removeEventListener('scroll', updateScrollInfo);
      resizeObserver.disconnect();
    };
  }, []);

  const scrollLeft = () => {
    if (contentRef.current) {
      // Scroll by one project card width (288px card + 16px gap = 304px)
      contentRef.current.scrollBy({ left: -304, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (contentRef.current) {
      // Scroll by one project card width (288px card + 16px gap = 304px)
      contentRef.current.scrollBy({ left: 304, behavior: 'smooth' });
    }
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (!contentRef.current || !containerRef.current) return;
    
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    
    const element = contentRef.current;
    const maxScroll = element.scrollWidth - element.clientWidth;
    element.scrollTo({ left: maxScroll * clickPosition, behavior: 'smooth' });
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Scrollable content */}
      <div
        ref={contentRef}
        className="overflow-x-auto scrollbar-hidden"
        style={{ maxHeight }}
      >
        {children}
      </div>

      {/* Custom scrollbar track - only show if content is scrollable */}
      {(scrollInfo.canScrollLeft || scrollInfo.canScrollRight) && (
        <div className="absolute bottom-0 left-4 right-4 h-[14px] mt-4 mb-2">
          {/* Unified scrollbar with integrated buttons */}
          <div className="relative h-full">
            {/* Overall glow effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400/25 via-purple-400/15 to-cyan-400/25 rounded-full blur-sm animate-pulse opacity-60 dark:opacity-80"></div>
            
            {/* Main track container */}
            <div className="relative h-full backdrop-blur-sm bg-gradient-to-r from-white/30 to-white/20 dark:from-white/10 dark:to-black/20 border border-gray-200/50 dark:border-gray-700/50 rounded-full shadow-sm flex items-center">
              
              {/* Left scroll button */}
              <div className="relative flex-shrink-0">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400/40 to-purple-400/30 rounded-l-full blur-sm animate-[pulse_2s_ease-in-out_infinite] opacity-60 dark:opacity-80"></div>
                <button
                  onClick={scrollLeft}
                  disabled={!scrollInfo.canScrollLeft}
                  className="relative w-[14px] h-[14px] backdrop-blur-sm bg-gradient-to-r from-white/40 to-white/30 dark:from-white/15 dark:to-black/25 border-r border-gray-200/50 dark:border-gray-700/50 hover:from-cyan-100/60 hover:to-cyan-50/40 dark:hover:from-cyan-900/30 dark:hover:to-cyan-800/20 disabled:opacity-40 disabled:cursor-not-allowed rounded-l-full transition-all duration-200 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 shadow-[0_0_4px_rgba(6,182,212,0.3)] hover:shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                >
                  <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              {/* Scrollable track area */}
              <div 
                className="flex-1 relative h-full cursor-pointer px-2"
                onClick={handleTrackClick}
              >
                {/* Scrollbar thumb with enhanced neon styling and glow */}
                <div className="relative h-full">
                  {/* Thumb glow effect */}
                  <div
                    className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400/60 to-cyan-500/70 rounded-full blur-sm animate-[pulse_3s_ease-in-out_infinite] opacity-70 dark:opacity-85"
                    style={{
                      left: `${scrollInfo.scrollPercentage * (100 - scrollInfo.thumbWidth)}%`,
                      width: `${scrollInfo.thumbWidth}%`,
                      top: '-1px',
                      bottom: '-1px'
                    }}
                  />
                  <div
                    className="absolute top-0.5 bottom-0.5 bg-gradient-to-r from-cyan-400/80 to-cyan-500/90 hover:from-cyan-400/90 hover:to-cyan-500/100 rounded-full transition-all duration-200 min-w-4 shadow-[0_0_6px_rgba(6,182,212,0.5)] hover:shadow-[0_0_10px_rgba(6,182,212,0.7)] border border-cyan-300/30 dark:border-cyan-400/30"
                    style={{
                      left: `${scrollInfo.scrollPercentage * (100 - scrollInfo.thumbWidth)}%`,
                      width: `${scrollInfo.thumbWidth}%`
                    }}
                  />
                </div>
              </div>
              
              {/* Right scroll button */}
              <div className="relative flex-shrink-0">
                <div className="absolute -inset-0.5 bg-gradient-to-l from-cyan-400/40 to-purple-400/30 rounded-r-full blur-sm animate-[pulse_2.5s_ease-in-out_infinite] opacity-60 dark:opacity-80"></div>
                <button
                  onClick={scrollRight}
                  disabled={!scrollInfo.canScrollRight}
                  className="relative w-[14px] h-[14px] backdrop-blur-sm bg-gradient-to-l from-white/40 to-white/30 dark:from-white/15 dark:to-black/25 border-l border-gray-200/50 dark:border-gray-700/50 hover:from-cyan-100/60 hover:to-cyan-50/40 dark:hover:from-cyan-900/30 dark:hover:to-cyan-800/20 disabled:opacity-40 disabled:cursor-not-allowed rounded-r-full transition-all duration-200 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 shadow-[0_0_4px_rgba(6,182,212,0.3)] hover:shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                >
                  <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
