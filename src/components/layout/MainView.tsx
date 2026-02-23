import { ViewType } from './AppLayout';
import { useTheme } from '../../contexts/ThemeContext';
import {
    AllTracksView, AlbumsView, ArtistsView, PlaylistsView, DashboardView,
    FavoritesView, GenresView, YearsView, FoldersView, FormatsView,
    AlbumContentsView, SongInfoView, ArtistInfoView,
    BigScreenView, HistoryView, QueueView
} from '../library';
import { SettingsView } from '../settings/SettingsView';

interface MainViewProps {
    currentView: ViewType;
    viewData?: any;
    onNavigate: (view: ViewType, data?: any) => void;
}

export const MainView: React.FC<MainViewProps> = ({ currentView, viewData, onNavigate }) => {
    const { currentPalette, settings: themeSettings } = useTheme();
    // Dynamic Content Routing
    const renderView = () => {
        switch (currentView) {
            case 'Dashboard':
                return <DashboardView onNavigate={onNavigate} />;
            case 'DetailedHistory':
                return <HistoryView onNavigate={onNavigate} />;
            case 'AllTracks':
                return <AllTracksView onNavigate={onNavigate} initialFilter={viewData?.filter} />;
            case 'Albums':
                return <AlbumsView onNavigate={onNavigate} />;
            case 'AlbumDetail':
                return <AlbumContentsView album={viewData} onNavigate={onNavigate} />;
            case 'SongDetail':
                return <SongInfoView track={viewData} />;
            case 'ArtistDetail':
                return <ArtistInfoView artistName={viewData} onNavigate={onNavigate} />;
            case 'Artists':
                return <ArtistsView onNavigate={onNavigate} />;
            case 'Genres':
                return <GenresView onNavigate={onNavigate} />;
            case 'Years':
                return <YearsView onNavigate={onNavigate} />;
            case 'Folders':
                return <FoldersView onNavigate={onNavigate} />;
            case 'Formats':
                return <FormatsView onNavigate={onNavigate} />;
            case 'Favorites':
                return <FavoritesView onNavigate={onNavigate} />;
            case 'Playlists':
                return <PlaylistsView onNavigate={onNavigate} />;
            case 'Settings':
                return <SettingsView initialTab={viewData?.tab} />;
            case 'BigScreen':
                return <BigScreenView onBack={() => onNavigate('Dashboard')} />;
            case 'Queue':
                return <QueueView />;
            default:
                return <DashboardView onNavigate={onNavigate} />;
        }
    };

    return (
        <main
            className="flex-1 overflow-y-auto transition-all duration-1000 relative custom-scrollbar overflow-x-hidden"
            style={{
                background: themeSettings.mode === 'adaptive' && !themeSettings.applyToNonEssentialsOnly
                    ? `linear-gradient(to bottom, ${currentPalette.dominant}15 0%, #0a0a0a 40%, #0a0a0a 100%)`
                    : 'linear-gradient(to bottom, #111 0%, #0a0a0a 100%)'
            }}
        >
            {/* Subtle top dominant color glow for native feel */}
            <div
                className="absolute top-0 left-0 right-0 h-[50vh] opacity-30 pointer-events-none blur-[120px] transition-all duration-1000"
                style={{ background: `radial-gradient(circle at 50% 0%, ${currentPalette.dominant}30 0%, transparent 100%)` }}
            ></div>
            <div className="relative z-10 h-full">
                {renderView()}
            </div>
        </main>
    );
};
