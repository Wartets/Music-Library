import React from 'react';
import { TrackItem } from '../../types/music';
import { ArtworkImage } from '../shared/ArtworkImage';

export const SongInfoView: React.FC<{ track: TrackItem }> = ({ track }) => {
    const artwork = track.artworks?.track_artwork?.[0] || track.artworks?.album_artwork?.[0];

    return (
        <div className="h-full flex flex-col p-8 overflow-y-auto custom-scrollbar">
            <div className="flex flex-col md:flex-row gap-12 mb-12">
                <div className="w-64 h-64 rounded-2xl overflow-hidden shadow-2xl border border-white/5 flex-shrink-0">
                    <ArtworkImage details={artwork} alt={track.metadata?.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col justify-end">
                    <h1 className="text-5xl font-black tracking-tight mb-4 text-white">{track.metadata?.title || track.logic.track_name}</h1>
                    <p className="text-2xl text-white/50 font-medium mb-4">{track.metadata?.artists?.join(', ')}</p>
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
            <div className="grid grid-cols-2 gap-8 max-w-2xl text-sm border-t border-white/5 pt-8">
                <div className="space-y-4">
                    <div>
                        <h3 className="text-gray-500 font-bold uppercase tracking-wider mb-1">Album</h3>
                        <p>{track.metadata?.album || 'Unknown'}</p>
                    </div>
                    <div>
                        <h3 className="text-gray-500 font-bold uppercase tracking-wider mb-1">File Path</h3>
                        <p className="break-all text-xs font-mono">{track.file.path}</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <h3 className="text-gray-500 font-bold uppercase tracking-wider mb-1">Audio Specs</h3>
                        <p>{track.audio_specs.bitrate} | {track.audio_specs.sample_rate} | {track.audio_specs.channels}</p>
                    </div>
                    <div>
                        <h3 className="text-gray-500 font-bold uppercase tracking-wider mb-1">File Size</h3>
                        <p>{(track.file.size_bytes / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
