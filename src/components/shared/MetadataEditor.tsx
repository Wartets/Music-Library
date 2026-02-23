import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { persistenceService } from '../../services/persistence';
import { Heart, Star, Disc, Hash, Music, Type, Save, X, Image as ImageIcon, Trash2, Edit2, Globe, Tag, Calendar, Mic, Link, Users, Building, ShieldCheck, Bookmark, FileText, Activity } from 'lucide-react';
import { TrackItem, TrackMetadata } from '../../types/music';
import { ArtworkImage } from './ArtworkImage';

export const MetadataEditor: React.FC = () => {
    const { editingTracks, setEditingTracks, updateTrackMetadata, updateArtworkOverride } = useLibrary();

    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [album, setAlbum] = useState('');
    const [albumArtist, setAlbumArtist] = useState('');
    const [genre, setGenre] = useState('');
    const [year, setYear] = useState('');
    const [composer, setComposer] = useState('');
    const [trackNumber, setTrackNumber] = useState('');
    const [totalTracks, setTotalTracks] = useState('');
    const [discNumber, setDiscNumber] = useState('');
    const [totalDiscs, setTotalDiscs] = useState('');
    const [bpm, setBpm] = useState('');
    const [lyrics, setLyrics] = useState('');
    const [comment, setComment] = useState('');
    const [artworkUrl, setArtworkUrl] = useState('');
    const [rating, setRating] = useState<number | 'mixed'>(0);
    const [isFav, setIsFav] = useState<boolean | 'mixed'>(false);

    // Expanded fields
    const [producer, setProducer] = useState('');
    const [label, setLabel] = useState('');
    const [publisher, setPublisher] = useState('');
    const [isrc, setIsrc] = useState('');
    const [upc, setUpc] = useState('');
    const [mood, setMood] = useState('');
    const [language, setLanguage] = useState('');
    const [category, setCategory] = useState('');
    const [tags, setTags] = useState('');
    const [remixArtist, setRemixArtist] = useState('');
    const [edition, setEdition] = useState('');
    const [recordingYear, setRecordingYear] = useState('');
    const [videoLink, setVideoLink] = useState('');
    const [streamingLink, setStreamingLink] = useState('');

    const [activeTab, setActiveTab] = useState<'general' | 'professional' | 'organization' | 'lyrics' | 'external'>('general');

    // Mixed value placeholders
    const [mixedFields, setMixedFields] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (editingTracks && editingTracks.length > 0) {
            const getSharedValue = (getter: (t: TrackItem) => any) => {
                const values = editingTracks.map(t => getter(t));
                const allSame = values.every(v => v === values[0]);
                return { value: allSame ? values[0] : '', isMixed: !allSame };
            };

            const titleInfo = getSharedValue(t => t.metadata?.title || t.logic?.track_name || '');
            const artistInfo = getSharedValue(t => t.metadata?.artists?.join(', ') || '');
            const albumInfo = getSharedValue(t => t.metadata?.album || '');
            const albumArtistInfo = getSharedValue(t => t.metadata?.album_artist || '');
            const genreInfo = getSharedValue(t => {
                const g = t.metadata?.genre;
                return Array.isArray(g) ? g.join(', ') : g || '';
            });
            const yearInfo = getSharedValue(t => t.metadata?.year || '');
            const composerInfo = getSharedValue(t => t.metadata?.composer || '');
            const trackNumInfo = getSharedValue(t => t.metadata?.track_number || '');
            const totalTracksInfo = getSharedValue(t => t.metadata?.total_tracks || '');
            const discNumInfo = getSharedValue(t => t.metadata?.disc_number || '');
            const totalDiscsInfo = getSharedValue(t => t.metadata?.total_discs || '');
            const bpmInfo = getSharedValue(t => t.metadata?.bpm || '');
            const lyricsInfo = getSharedValue(t => t.metadata?.lyrics || '');
            const commentInfo = getSharedValue(t => t.metadata?.comment || '');
            const artworkUrlInfo = getSharedValue(t => t.artworks?.track_artwork?.[0]?.path || '');

            // Expanded initializations
            const producerInfo = getSharedValue(t => t.metadata?.producer || '');
            const labelInfo = getSharedValue(t => t.metadata?.label || '');
            const publisherInfo = getSharedValue(t => t.metadata?.publisher || '');
            const isrcInfo = getSharedValue(t => t.metadata?.isrc || '');
            const upcInfo = getSharedValue(t => t.metadata?.upc || '');
            const moodInfo = getSharedValue(t => t.metadata?.mood || '');
            const languageInfo = getSharedValue(t => t.metadata?.language || '');
            const categoryInfo = getSharedValue(t => t.metadata?.category || '');
            const tagsInfo = getSharedValue(t => t.metadata?.tags?.join(', ') || '');
            const remixArtistInfo = getSharedValue(t => t.metadata?.remix_artist || '');
            const editionInfo = getSharedValue(t => t.metadata?.edition || '');
            const recordingYearInfo = getSharedValue(t => t.metadata?.recording_year || '');
            const videoLinkInfo = getSharedValue(t => t.metadata?.video_link || '');
            const streamingLinkInfo = getSharedValue(t => t.metadata?.streaming_link || '');

            const ratingValues = editingTracks.map(t => persistenceService.getRating(t.logic.hash_sha256));
            const ratingMixed = !ratingValues.every(v => v === ratingValues[0]);

            const favValues = editingTracks.map(t => persistenceService.isFavorite(t.logic.hash_sha256));
            const favMixed = !favValues.every(v => v === favValues[0]);

            setTitle(titleInfo.value);
            setArtist(artistInfo.value);
            setAlbum(albumInfo.value);
            setAlbumArtist(albumArtistInfo.value);
            setGenre(genreInfo.value);
            setYear(yearInfo.value);
            setComposer(composerInfo.value);
            setTrackNumber(trackNumInfo.value);
            setTotalTracks(totalTracksInfo.value);
            setDiscNumber(discNumInfo.value);
            setTotalDiscs(totalDiscsInfo.value);
            setBpm(bpmInfo.value);
            setLyrics(lyricsInfo.value);
            setComment(commentInfo.value);
            setArtworkUrl(artworkUrlInfo.value);
            setRating(ratingMixed ? 'mixed' : ratingValues[0]);
            setIsFav(favMixed ? 'mixed' : favValues[0]);

            // Set expanded state
            setProducer(producerInfo.value);
            setLabel(labelInfo.value);
            setPublisher(publisherInfo.value);
            setIsrc(isrcInfo.value);
            setUpc(upcInfo.value);
            setMood(moodInfo.value);
            setLanguage(languageInfo.value);
            setCategory(categoryInfo.value);
            setTags(tagsInfo.value);
            setRemixArtist(remixArtistInfo.value);
            setEdition(editionInfo.value);
            setRecordingYear(recordingYearInfo.value);
            setVideoLink(videoLinkInfo.value);
            setStreamingLink(streamingLinkInfo.value);

            const mixed = new Set<string>();
            if (titleInfo.isMixed) mixed.add('title');
            if (artistInfo.isMixed) mixed.add('artist');
            if (albumInfo.isMixed) mixed.add('album');
            if (albumArtistInfo.isMixed) mixed.add('albumArtist');
            if (genreInfo.isMixed) mixed.add('genre');
            if (yearInfo.isMixed) mixed.add('year');
            if (composerInfo.isMixed) mixed.add('composer');
            if (trackNumInfo.isMixed) mixed.add('trackNumber');
            if (totalTracksInfo.isMixed) mixed.add('totalTracks');
            if (discNumber) if (discNumInfo.isMixed) mixed.add('discNumber');
            if (totalDiscsInfo.isMixed) mixed.add('totalDiscs');
            if (bpmInfo.isMixed) mixed.add('bpm');
            if (lyricsInfo.isMixed) mixed.add('lyrics');
            if (commentInfo.isMixed) mixed.add('comment');
            if (artworkUrlInfo.isMixed) mixed.add('artworkUrl');

            // Add expanded mixed states
            if (producerInfo.isMixed) mixed.add('producer');
            if (labelInfo.isMixed) mixed.add('label');
            if (publisherInfo.isMixed) mixed.add('publisher');
            if (isrcInfo.isMixed) mixed.add('isrc');
            if (upcInfo.isMixed) mixed.add('upc');
            if (moodInfo.isMixed) mixed.add('mood');
            if (languageInfo.isMixed) mixed.add('language');
            if (categoryInfo.isMixed) mixed.add('category');
            if (tagsInfo.isMixed) mixed.add('tags');
            if (remixArtistInfo.isMixed) mixed.add('remixArtist');
            if (editionInfo.isMixed) mixed.add('edition');
            if (recordingYearInfo.isMixed) mixed.add('recordingYear');
            if (videoLinkInfo.isMixed) mixed.add('videoLink');
            if (streamingLinkInfo.isMixed) mixed.add('streamingLink');

            setMixedFields(mixed);
        }
    }, [editingTracks]);

    if (!editingTracks || editingTracks.length === 0) return null;

    const handleSave = () => {
        editingTracks.forEach(track => {
            const hash = track.logic?.hash_sha256;
            if (!hash) return;

            const update: Partial<TrackMetadata> = {};
            if (!mixedFields.has('title')) update.title = title.trim();
            if (!mixedFields.has('artist')) update.artists = artist ? artist.split(',').map(a => a.trim()) : undefined;
            if (!mixedFields.has('album')) update.album = album.trim();
            if (!mixedFields.has('albumArtist')) update.album_artist = albumArtist.trim();
            if (!mixedFields.has('genre')) update.genre = genre ? genre.trim() : null;
            if (!mixedFields.has('year')) update.year = year.trim() || null;
            if (!mixedFields.has('composer')) update.composer = composer.trim();
            if (!mixedFields.has('trackNumber')) update.track_number = trackNumber.trim() || null;
            if (!mixedFields.has('totalTracks')) update.total_tracks = totalTracks.trim() || null;
            if (!mixedFields.has('discNumber')) update.disc_number = discNumber.trim() || null;
            if (!mixedFields.has('totalDiscs')) update.total_discs = totalDiscs.trim() || null;
            if (!mixedFields.has('bpm')) update.bpm = bpm.trim() || null;
            if (!mixedFields.has('lyrics')) update.lyrics = lyrics.trim() || null;
            if (!mixedFields.has('comment')) update.comment = comment.trim() || null;

            // Expanded saves
            if (!mixedFields.has('producer')) update.producer = producer.trim() || null;
            if (!mixedFields.has('label')) update.label = label.trim() || null;
            if (!mixedFields.has('publisher')) update.publisher = publisher.trim() || null;
            if (!mixedFields.has('isrc')) update.isrc = isrc.trim() || null;
            if (!mixedFields.has('upc')) update.upc = upc.trim() || null;
            if (!mixedFields.has('mood')) update.mood = mood.trim() || null;
            if (!mixedFields.has('language')) update.language = language.trim() || null;
            if (!mixedFields.has('category')) update.category = category.trim() || null;
            if (!mixedFields.has('tags')) update.tags = tags ? tags.split(',').map(t => t.trim()) : null;
            if (!mixedFields.has('remixArtist')) update.remix_artist = remixArtist.trim() || null;
            if (!mixedFields.has('edition')) update.edition = edition.trim() || null;
            if (!mixedFields.has('recordingYear')) update.recording_year = recordingYear.trim() || null;
            if (!mixedFields.has('videoLink')) update.video_link = videoLink.trim() || null;
            if (!mixedFields.has('streamingLink')) update.streaming_link = streamingLink.trim() || null;

            updateTrackMetadata(hash, update);

            if (!mixedFields.has('artworkUrl')) {
                if (artworkUrl !== (track.artworks?.track_artwork?.[0]?.path || '')) {
                    if (artworkUrl === '') {
                        updateArtworkOverride(hash, []);
                    } else {
                        updateArtworkOverride(hash, [{
                            name: 'Custom Artwork',
                            type: 'URL',
                            path: artworkUrl,
                            size_bytes: 0,
                            dimensions: 'Unknown',
                            aspect_ratio: 'Square',
                            dominant_color: '#888888'
                        }]);
                    }
                }
            }

            if (rating !== 'mixed') {
                persistenceService.setRating(hash, rating);
            }
            if (isFav !== 'mixed') {
                if (isFav !== persistenceService.isFavorite(hash)) {
                    persistenceService.toggleFavorite(hash);
                }
            }
        });

        setEditingTracks(null);
    };

    const inputClass = (fieldName: string) => `w-full bg-black/50 border ${mixedFields.has(fieldName) ? 'border-yellow-500/30' : 'border-white/10'} rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-dominant focus:ring-1 focus:ring-dominant transition-all`;

    const handleInputChange = (field: string, value: string, setter: (v: string) => void) => {
        setter(value);
        if (mixedFields.has(field)) {
            setMixedFields(prev => {
                const next = new Set(prev);
                next.delete(field);
                return next;
            });
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setEditingTracks(null)}>
            <div
                className="bg-[#111] border border-white/10 rounded-2xl shadow-3xl w-full max-w-2xl p-8 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">
                            {editingTracks.length > 1 ? `Edit ${editingTracks.length} Tracks` : 'Edit Metadata'}
                        </h2>
                        {editingTracks.length > 1 && (
                            <p className="text-yellow-500/70 text-[10px] font-bold uppercase tracking-widest mt-1">
                                Fields marked as "Mixed" will not be updated unless modified.
                            </p>
                        )}
                    </div>
                    <button onClick={() => setEditingTracks(null)} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-all">
                        <X size={24} />
                    </button>
                </div>

                {/* Top Section: Artwork & Ratings */}
                <div className="flex flex-col md:flex-row gap-8 mb-10">
                    {/* Artwork Preview */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group">
                            <div className="w-40 h-40 rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 group-hover:border-dominant transition-all duration-300">
                                {mixedFields.has('artworkUrl') ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-yellow-500 bg-yellow-500/5 text-center p-4">
                                        <ImageIcon size={32} className="mb-2 opacity-50" />
                                        <span className="text-[10px] font-black uppercase tracking-widest underline decoration-2 underline-offset-4">Mixed Artworks</span>
                                    </div>
                                ) : (
                                    <ArtworkImage
                                        src={artworkUrl}
                                        className="w-full h-full object-cover"
                                        fallback={<Music className="w-12 h-12 text-gray-800" />}
                                    />
                                )}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2 backdrop-blur-sm">
                                    <button
                                        onClick={() => {
                                            const url = prompt('Enter Artwork Image URL:', artworkUrl);
                                            if (url !== null) handleInputChange('artworkUrl', url, setArtworkUrl);
                                        }}
                                        className="p-2 bg-dominant text-black rounded-lg hover:scale-110 transition-transform"
                                        title="Change Image URL"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleInputChange('artworkUrl', '', setArtworkUrl)}
                                        className="p-2 bg-red-500 text-white rounded-lg hover:scale-110 transition-transform"
                                        title="Remove Artwork Overrides"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <span className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Artwork Preview</span>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                        {/* Rating Row */}
                        <div className="mb-4 p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mr-4">Rating</span>
                                {[1, 2, 3, 4, 5].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setRating(s === (rating as number) ? 0 : s)}
                                        className={`group relative transition-all ${rating === 'mixed' ? 'text-yellow-500/20' : (s <= (rating as number) ? 'text-yellow-400 scale-110' : 'text-gray-700 hover:text-yellow-400/50')}`}
                                    >
                                        <Star size={20} fill={(rating !== 'mixed' && s <= (rating as number)) ? 'currentColor' : 'none'} strokeWidth={2.5} />
                                        {rating === 'mixed' && s === 1 && (
                                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Mixed</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Favorite Row */}
                        <button
                            onClick={() => setIsFav(isFav === 'mixed' ? true : !isFav)}
                            className={`flex items-center justify-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black transition-all border w-full uppercase tracking-[0.25em] ${isFav === 'mixed'
                                ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                                : (isFav ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/5 text-gray-500 border-white/5 hover:text-red-400')
                                }`}
                        >
                            <Heart size={14} fill={isFav === true ? 'currentColor' : 'none'} strokeWidth={2.5} />
                            {isFav === 'mixed' ? 'Mixed Favorites' : (isFav ? 'In Favorites' : 'Add to Favorites')}
                        </button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 mb-8 p-1 bg-white/5 rounded-xl border border-white/10">
                    {[
                        { id: 'general', label: 'Info', icon: <Type size={14} /> },
                        { id: 'professional', label: 'Credits', icon: <ShieldCheck size={14} /> },
                        { id: 'organization', label: 'Organization', icon: <Tag size={14} /> },
                        { id: 'lyrics', label: 'Lyrics', icon: <FileText size={14} /> },
                        { id: 'external', label: 'Links', icon: <Globe size={14} /> },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                                ? 'bg-dominant text-on-dominant shadow-lg shadow-dominant/20'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Tab Contents */}
                <div className="min-h-[400px]">
                    {activeTab === 'general' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-left-4 duration-300">
                            <div className="md:col-span-2">
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Type size={12} /> Title
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('title')}
                                    value={title}
                                    onChange={e => handleInputChange('title', e.target.value, setTitle)}
                                    placeholder={mixedFields.has('title') ? '--- Mixed Titles ---' : 'Track Title'}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Mic size={12} /> Artist(s)
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('artist')}
                                    value={artist}
                                    onChange={e => handleInputChange('artist', e.target.value, setArtist)}
                                    placeholder={mixedFields.has('artist') ? '--- Mixed Artists ---' : 'Artist(s), comma-separated'}
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Disc size={12} /> Album
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('album')}
                                    value={album}
                                    onChange={e => handleInputChange('album', e.target.value, setAlbum)}
                                    placeholder={mixedFields.has('album') ? '--- Mixed Albums ---' : 'Album Name'}
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Users size={12} /> Album Artist
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('albumArtist')}
                                    value={albumArtist}
                                    onChange={e => handleInputChange('albumArtist', e.target.value, setAlbumArtist)}
                                    placeholder={mixedFields.has('albumArtist') ? '--- Mixed Album Artists ---' : 'Album Artist'}
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Tag size={12} /> Genre
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('genre')}
                                    value={genre}
                                    onChange={e => handleInputChange('genre', e.target.value, setGenre)}
                                    placeholder={mixedFields.has('genre') ? '--- Mixed Genres ---' : 'Genre'}
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Calendar size={12} /> Release Year
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('year')}
                                    value={year}
                                    onChange={e => handleInputChange('year', e.target.value, setYear)}
                                    placeholder={mixedFields.has('year') ? '--- Mixed Years ---' : 'Year (e.g. 2024)'}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                        <Hash size={12} /> Track #
                                    </label>
                                    <input
                                        type="text"
                                        className={inputClass('trackNumber')}
                                        value={trackNumber}
                                        onChange={e => handleInputChange('trackNumber', e.target.value, setTrackNumber)}
                                        placeholder={mixedFields.has('trackNumber') ? '---' : '1'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Total Tracks</label>
                                    <input
                                        type="text"
                                        className={inputClass('totalTracks')}
                                        value={totalTracks}
                                        onChange={e => handleInputChange('totalTracks', e.target.value, setTotalTracks)}
                                        placeholder={mixedFields.has('totalTracks') ? '---' : '12'}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Disc #</label>
                                    <input
                                        type="text"
                                        className={inputClass('discNumber')}
                                        value={discNumber}
                                        onChange={e => handleInputChange('discNumber', e.target.value, setDiscNumber)}
                                        placeholder={mixedFields.has('discNumber') ? '---' : '1'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Total Discs</label>
                                    <input
                                        type="text"
                                        className={inputClass('totalDiscs')}
                                        value={totalDiscs}
                                        onChange={e => handleInputChange('totalDiscs', e.target.value, setTotalDiscs)}
                                        placeholder={mixedFields.has('totalDiscs') ? '---' : '1'}
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Comment</label>
                                <input
                                    type="text"
                                    className={inputClass('comment')}
                                    value={comment}
                                    onChange={e => handleInputChange('comment', e.target.value, setComment)}
                                    placeholder={mixedFields.has('comment') ? '--- Mixed Comments ---' : 'Notes...'}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'professional' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Users size={12} /> Producer
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('producer')}
                                    value={producer}
                                    onChange={e => handleInputChange('producer', e.target.value, setProducer)}
                                    placeholder={mixedFields.has('producer') ? '--- Mixed ---' : 'Producer Name'}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Mic size={12} /> Remix Artist
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('remixArtist')}
                                    value={remixArtist}
                                    onChange={e => handleInputChange('remixArtist', e.target.value, setRemixArtist)}
                                    placeholder={mixedFields.has('remixArtist') ? '--- Mixed ---' : 'Remixer'}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Building size={12} /> Label
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('label')}
                                    value={label}
                                    onChange={e => handleInputChange('label', e.target.value, setLabel)}
                                    placeholder={mixedFields.has('label') ? '--- Mixed ---' : 'Record Label'}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Building size={12} /> Publisher
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('publisher')}
                                    value={publisher}
                                    onChange={e => handleInputChange('publisher', e.target.value, setPublisher)}
                                    placeholder={mixedFields.has('publisher') ? '--- Mixed ---' : 'Music Publisher'}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <ShieldCheck size={12} /> ISRC
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('isrc')}
                                    value={isrc}
                                    onChange={e => handleInputChange('isrc', e.target.value, setIsrc)}
                                    placeholder={mixedFields.has('isrc') ? '--- Mixed ---' : 'ISRC Code'}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <ShieldCheck size={12} /> UPC/EAN
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('upc')}
                                    value={upc}
                                    onChange={e => handleInputChange('upc', e.target.value, setUpc)}
                                    placeholder={mixedFields.has('upc') ? '--- Mixed ---' : 'Barcode'}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Bookmark size={12} /> Edition
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('edition')}
                                    value={edition}
                                    onChange={e => handleInputChange('edition', e.target.value, setEdition)}
                                    placeholder={mixedFields.has('edition') ? '--- Mixed ---' : 'Deluxe, Remastered...'}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Calendar size={12} /> Year of Recording
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('recordingYear')}
                                    value={recordingYear}
                                    onChange={e => handleInputChange('recordingYear', e.target.value, setRecordingYear)}
                                    placeholder={mixedFields.has('recordingYear') ? '--- Mixed ---' : '2023'}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'organization' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Activity size={12} /> BPM
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('bpm')}
                                    value={bpm}
                                    onChange={e => handleInputChange('bpm', e.target.value, setBpm)}
                                    placeholder={mixedFields.has('bpm') ? '---' : '120'}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Heart size={12} /> Mood
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('mood')}
                                    value={mood}
                                    onChange={e => handleInputChange('mood', e.target.value, setMood)}
                                    placeholder={mixedFields.has('mood') ? '--- Mixed ---' : 'Happy, Chill...'}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Globe size={12} /> Language
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('language')}
                                    value={language}
                                    onChange={e => handleInputChange('language', e.target.value, setLanguage)}
                                    placeholder={mixedFields.has('language') ? '--- Mixed ---' : 'English, French...'}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Tag size={12} /> Category
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('category')}
                                    value={category}
                                    onChange={e => handleInputChange('category', e.target.value, setCategory)}
                                    placeholder={mixedFields.has('category') ? '--- Mixed ---' : 'Soundtrack, Single...'}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Hash size={12} /> Custom Tags
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('tags')}
                                    value={tags}
                                    onChange={e => handleInputChange('tags', e.target.value, setTags)}
                                    placeholder={mixedFields.has('tags') ? '--- Mixed Tags ---' : 'Comma-separated tags'}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'lyrics' && (
                        <div className="animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
                            <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                <FileText size={12} /> Track Lyrics
                            </label>
                            <textarea
                                className={`${inputClass('lyrics')} resize-none flex-1 min-h-[350px] leading-relaxed custom-scrollbar text-base font-medium p-6`}
                                value={lyrics}
                                onChange={e => handleInputChange('lyrics', e.target.value, setLyrics)}
                                placeholder={mixedFields.has('lyrics') ? '--- Mixed Lyrics Content ---' : 'Paste or write lyrics here...'}
                            />
                        </div>
                    )}

                    {activeTab === 'external' && (
                        <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-bottom-4 duration-300">
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Link size={12} /> Video Link (YouTube/Vimeo)
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('videoLink')}
                                    value={videoLink}
                                    onChange={e => handleInputChange('videoLink', e.target.value, setVideoLink)}
                                    placeholder={mixedFields.has('videoLink') ? '--- Mixed ---' : 'https://...'}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                                    <Link size={12} /> Streaming Link (Spotify/Apple)
                                </label>
                                <input
                                    type="text"
                                    className={inputClass('streamingLink')}
                                    value={streamingLink}
                                    onChange={e => handleInputChange('streamingLink', e.target.value, setStreamingLink)}
                                    placeholder={mixedFields.has('streamingLink') ? '--- Mixed ---' : 'https://...'}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Actions */}
                <div className="sticky bottom-0 bg-[#111] pt-6 border-t border-white/10 mt-4 pb-2 z-10">
                    <div className="flex justify-between items-center gap-4">
                        <p className="text-[9px] text-gray-500 font-bold leading-relaxed uppercase tracking-widest max-w-[50%]">
                            * Changes are stored locally. Original audio files are not modified.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setEditingTracks(null)}
                                className="px-6 py-3 rounded-xl text-xs font-black text-gray-500 hover:text-white hover:bg-white/5 transition-all uppercase tracking-[0.2em]"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-3 px-10 py-3 bg-dominant text-on-dominant rounded-xl text-xs font-black hover:bg-dominant-light transition-all shadow-2xl shadow-dominant/40 uppercase tracking-[0.2em]"
                            >
                                <Save size={16} />
                                Apply to {editingTracks.length} track{editingTracks.length > 1 ? 's' : ''}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const UserIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
);
