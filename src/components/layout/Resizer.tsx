import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';

interface ResizerProps {
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

export const Resizer: React.FC<ResizerProps> = ({
  onResize,
  onResizeStart,
  onResizeEnd,
}) => {
  const { theme } = useAppStore();
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    onResizeStart?.();
    
    // 添加全局鼠标样式
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [onResizeStart]);

  useEffect(() => {
    if (!isResizing) return;

    let animationFrameId: number;
    let lastClientX: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (lastClientX === null) {
        lastClientX = e.clientX;
        return;
      }

      // 使用 requestAnimationFrame 优化性能
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        if (lastClientX !== null) {
          const delta = e.clientX - lastClientX;
          lastClientX = e.clientX;
          onResize(delta);
        }
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      onResizeEnd?.();
      
      // 恢复全局鼠标样式
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isResizing, onResize, onResizeEnd]);

  return (
    <div
      className={cn(
        'z-10 flex w-1.5 flex-shrink-0 cursor-col-resize items-center justify-center bg-transparent transition-colors duration-150',
        isResizing ? 'bg-[#007acc]' : 'hover:bg-[#e0e0e0]',
      )}
      onMouseDown={handleMouseDown}
      title="拖动调整宽度"
    >
      <div
        className={cn(
          'h-10 w-0.5 rounded-[1px] opacity-50 transition-opacity duration-150',
          theme === 'dark' ? 'bg-[#3e3e42]' : 'bg-[#e0e0e0]',
          isResizing && 'bg-[#007acc] opacity-100',
        )}
      />
    </div>
  );
};
