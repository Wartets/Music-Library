import React from 'react';
import { ImageDetails } from '../../types/music';

interface ArtworkImageProps {
    details?: ImageDetails;
    src?: string;
    alt?: string;
    className?: string;
    fallback?: React.ReactNode;
}

export const ArtworkImage: React.FC<ArtworkImageProps> = ({ details, src, alt = 'Artwork', className = '', fallback }) => {
    const displaySrc = React.useMemo(() => {
        if (src) return src;
        if (!details || !details.path) return null;
        return details.path.split('/').map(segment => encodeURIComponent(segment)).join('/');
    }, [src, details]);

    if (!displaySrc) {
        return (
            <div className={`flex items-center justify-center bg-white/5 text-white/20 ${className}`}>
                {fallback || (
                    <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9 12v-2"></path><path d="M15 12v-2"></path><path d="M12 15v.01"></path></svg>
                )}
            </div>
        );
    }

    return (
        <img
            src={displaySrc}
            alt={alt}
            className={`object-cover ${className}`}
            onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                if (target.parentElement) {
                    target.parentElement.classList.add('bg-dominant/20', 'flex', 'items-center', 'justify-center');
                    target.parentElement.innerHTML = '<span class="text-[10px] opacity-30 font-bold tracking-tighter">?</span>';
                }
            }}
        />
    );
};
