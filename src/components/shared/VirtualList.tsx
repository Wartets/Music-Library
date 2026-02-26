import React, { useState, useRef, useEffect, useCallback } from 'react';

interface VirtualListProps {
    items: any[];
    rowHeight: number;
    renderRow: (item: any, index: number) => React.ReactNode;
    overscan?: number;
}

export const VirtualList: React.FC<VirtualListProps> = ({
    items,
    rowHeight,
    renderRow,
    overscan = 5
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(600); // Default fallback
    const rafRef = useRef<number | null>(null);
    const lastScrollTopRef = useRef(0);

    useEffect(() => {
        if (containerRef.current) {
            setContainerHeight(containerRef.current.clientHeight);

            // Resize observer handles dynamic container changes
            const observer = new ResizeObserver((entries) => {
                const el = entries[0]?.target as HTMLElement;
                if (el) {
                    setContainerHeight(el.clientHeight);
                }
            });
            observer.observe(containerRef.current);
            return () => observer.disconnect();
        }
    }, []);

    useEffect(() => {
        return () => {
            if (rafRef.current !== null) {
                window.cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, []);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        lastScrollTopRef.current = e.currentTarget.scrollTop;
        if (rafRef.current !== null) return;
        rafRef.current = window.requestAnimationFrame(() => {
            setScrollTop(lastScrollTopRef.current);
            rafRef.current = null;
        });
    }, []);

    const totalHeight = items.length * rowHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endIndex = Math.min(items.length - 1, Math.floor((scrollTop + containerHeight) / rowHeight) + overscan);

    const visibleItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
        visibleItems.push(
            <div
                key={i}
                style={{
                    position: 'absolute',
                    top: `${i * rowHeight}px`,
                    width: '100%',
                    height: `${rowHeight}px`
                }}
            >
                {renderRow(items[i], i)}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            style={{ height: '100%', width: '100%', overflowY: 'auto', position: 'relative' }}
        >
            <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                {visibleItems}
            </div>
        </div>
    );
};
