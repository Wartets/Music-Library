import React from 'react';
import { TrackItem } from '../../types/music';
import { ArtworkImage } from '../shared/ArtworkImage';
import { usePlayer } from '../../contexts/PlayerContext';
import { Play } from 'lucide-react';

export const SongInfoView: React.FC<{ track: TrackItem }> = ({ track }) => {
    const { playTrack } = usePlayer();
    const artwork = track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0];
    const versions = track.versions || [track];

    return (
        <div className="h-full flex flex-col px-3 md:px-8 pb-6 md:pb-8 pt-16 md:pt-28 overflow-y-auto custom-scrollbar">
            <div className="flex flex-col md:flex-row gap-6 md:gap-12 mb-6 md:mb-12">
                <div className="w-40 h-40 md:w-64 md:h-64 rounded-2xl overflow-hidden shadow-2xl border border-white/5 flex-shrink-0">
                    <ArtworkImage details={artwork} alt={track.metadata?.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col justify-end">
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3 md:mb-4 text-white">{track.metadata?.title || track.logic.track_name}</h1>
                    <p className="text-lg md:text-2xl text-white/50 font-medium mb-3 md:mb-4">{track.metadata?.artists?.join(', ')}</p>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-full text-gray-400">
                            {track.logic.track_name}
                        </span>
                        <span className="text-xs font-bold bg-dominant/20 px-3 py-1 rounded-full text-dominant-light">
                            {track.logic.version_name}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 border-t border-white/5 pt-8">
                <div className="space-y-8">
                    <div>
                        <h3 className="text-gray-500 font-bold uppercase tracking-wider mb-4 border-b border-white/5 pb-2 text-xs">Available Versions</h3>
                        <div className="space-y-2">
                            {versions.map((v) => (
                                <div
                                    key={v.logic.hash_sha256}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all group ${v.logic.hash_sha256 === track.logic.hash_sha256
                                            ? 'bg-dominant/10 border-dominant/30 shadow-[0_0_20px_rgba(var(--color-dominant-rgb),0.1)]'
                                            : 'bg-white/5 border-transparent hover:border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-bold truncate">{v.logic.version_name}</span>
                                            {v.logic.hash_sha256 === track.logic.hash_sha256 && (
                                                <span className="text-[10px] bg-dominant text-white px-1.5 py-0.5 rounded uppercase font-black">Latest</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-white/40 mt-1 flex items-center gap-2">
                                            <span>{v.audio_specs.bitrate}</span>
                                            <span>•</span>
                                            <span>Modified: {v.file.modified.split(' ')[0]}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => playTrack(v)}
                                        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white text-white hover:text-black flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Play size={16} fill="currentColor" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div>
                        <h3 className="text-gray-500 font-bold uppercase tracking-wider mb-4 border-b border-white/5 pb-2 text-xs">Metadata & Specs</h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-[10px] text-white/30 font-black uppercase mb-1">Album</h4>
                                <p className="text-sm">{track.metadata?.album || 'Unknown'}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] text-white/30 font-black uppercase mb-1">Audio Quality</h4>
                                <p className="text-sm">{track.audio_specs.bitrate} | {track.audio_specs.sample_rate}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] text-white/30 font-black uppercase mb-1">Duration</h4>
                                <p className="text-sm">{track.audio_specs.duration}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] text-white/30 font-black uppercase mb-1">File Size</h4>
                                <p className="text-sm">{(track.file.size_bytes / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-[10px] text-white/30 font-black uppercase mb-2">Original File Path</h4>
                        <p className="break-all text-[10px] font-mono text-white/40 bg-white/5 p-3 rounded-lg border border-white/5">{track.file.path}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
