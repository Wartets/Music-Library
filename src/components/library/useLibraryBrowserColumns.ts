import { useMemo } from 'react';
import { ColumnConfig } from '../../types/music';

export const useLibraryBrowserColumns = (columnConfig: ColumnConfig[]) => {
    const visibleColumns = useMemo(
        () => columnConfig.filter(column => column.visible),
        [columnConfig]
    );

    const gridTemplate = useMemo(() => {
        return visibleColumns
            .map(column => {
                if (column.id === 'title') return 'minmax(200px, 1fr)';
                return column.width === 0 ? '1fr' : `${column.width}px`;
            })
            .join(' ');
    }, [visibleColumns]);

    return { visibleColumns, gridTemplate };
};