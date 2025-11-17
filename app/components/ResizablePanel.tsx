import { useState, useRef, useEffect, useCallback } from 'react'

interface ResizablePanelProps {
  children: React.ReactNode
  direction: 'horizontal' | 'vertical'
  minSize?: number
  maxSize?: number
  defaultSize?: number
  storageKey?: string
  onResize?: (size: number) => void
  resizeFrom?: 'start' | 'end' // 'start' = left/top, 'end' = right/bottom
}

export function ResizablePanel({
  children,
  direction,
  minSize = 100,
  maxSize,
  defaultSize,
  storageKey,
  onResize,
  resizeFrom = 'end',
}: ResizablePanelProps) {
  const [size, setSize] = useState(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= minSize && (!maxSize || parsed <= maxSize)) {
          return parsed
        }
      }
    }
    return defaultSize || (direction === 'horizontal' ? 250 : 200)
  })

  const [isDragging, setIsDragging] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const startPosRef = useRef(0)
  const startSizeRef = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY
    startSizeRef.current = size
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [direction, size])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = direction === 'horizontal' 
        ? e.clientX - startPosRef.current
        : e.clientY - startPosRef.current
      
      // If resizing from start (left/top), invert the delta
      const adjustedDelta = resizeFrom === 'start' ? -delta : delta
      let newSize = startSizeRef.current + adjustedDelta
      
      if (newSize < minSize) newSize = minSize
      if (maxSize && newSize > maxSize) newSize = maxSize
      
      setSize(newSize)
      if (onResize) onResize(newSize)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      
      if (storageKey && typeof window !== 'undefined') {
        localStorage.setItem(storageKey, size.toString())
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, direction, minSize, maxSize, storageKey, size, onResize, resizeFrom])

  const style: React.CSSProperties = {
    [direction === 'horizontal' ? 'width' : 'height']: `${size}px`,
    flexShrink: 0,
    position: 'relative',
  }

  const handlePosition = resizeFrom === 'start' 
    ? (direction === 'horizontal' ? 'left' : 'top')
    : (direction === 'horizontal' ? 'right' : 'bottom')

  return (
    <div ref={panelRef} style={style} className="relative">
      {children}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute ${
          direction === 'horizontal'
            ? resizeFrom === 'start'
              ? 'left-0 top-0 w-2 h-full cursor-col-resize z-20'
              : 'right-0 top-0 w-2 h-full cursor-col-resize z-20'
            : resizeFrom === 'start'
              ? 'top-0 left-0 h-2 w-full cursor-row-resize z-20'
              : 'bottom-0 left-0 h-2 w-full cursor-row-resize z-20'
        } transition-colors group hover:bg-primary/10`}
        style={{
          [handlePosition]: '-4px',
        }}
      >
        <div
          className={`absolute ${
            direction === 'horizontal'
              ? resizeFrom === 'start'
                ? 'left-1 top-0 w-0.5 h-full bg-border group-hover:bg-primary'
                : 'right-1 top-0 w-0.5 h-full bg-border group-hover:bg-primary'
              : resizeFrom === 'start'
                ? 'top-1 left-0 h-0.5 w-full bg-border group-hover:bg-primary'
                : 'bottom-1 left-0 h-0.5 w-full bg-border group-hover:bg-primary'
          } transition-colors`}
        />
      </div>
    </div>
  )
}

