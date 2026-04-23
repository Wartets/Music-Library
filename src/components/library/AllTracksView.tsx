import React, { useEffect, useMemo } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { LibraryBrowser } from './LibraryBrowser';
import { Hash } from 'lucide-react';

interface AllTracksViewProps {
    onNavigate?: (view: any, data?: any) => void;
    initialFilter?: {
        type: 'year' | 'folder' | 'format' | 'genre' | 'artist';
        value: string;
    };
}

export const AllTracksView: React.FC<AllTracksViewProps> = ({ onNavigate, initialFilter }) => {
    const { state: libraryState, setSearchQuery } = useLibrary();

    useEffect(() => {
        if (initialFilter) {
            const { type, value } = initialFilter;
            const normalizedValue = /\s/.test(value) ? `"${value}"` : value;
            setSearchQuery(`${type}:${normalizedValue}`);
        }
    }, [initialFilter, setSearchQuery]);

    const title = useMemo(() => {
        if (initialFilter) {
            return `${initialFilter.type.charAt(0).toUpperCase() + initialFilter.type.slice(1)}: ${initialFilter.value}`;
        }
        return "All Tracks";
    }, [initialFilter]);

    return (
        <LibraryBrowser
            title={title}
            tracks={libraryState.filteredTracks}
            onNavigate={onNavigate || (() => { })}
            headerIcon={<Hash size={32} />}
            subtitle={initialFilter ? `Filtered by ${initialFilter.type}` : "All Indexed Tracks"}
        />
    );
};
