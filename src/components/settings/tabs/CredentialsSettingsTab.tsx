import React from 'react';
import { ExternalLink, User } from 'lucide-react';

const packageLicenseLinks = {
    dependencies: [
        { name: 'react', url: 'https://www.npmjs.com/package/react' },
        { name: 'react-dom', url: 'https://www.npmjs.com/package/react-dom' },
        { name: 'react-router-dom', url: 'https://www.npmjs.com/package/react-router-dom' },
        { name: '@dnd-kit/core', url: 'https://www.npmjs.com/package/@dnd-kit/core' },
        { name: '@dnd-kit/sortable', url: 'https://www.npmjs.com/package/@dnd-kit/sortable' },
        { name: '@dnd-kit/utilities', url: 'https://www.npmjs.com/package/@dnd-kit/utilities' },
        { name: 'lucide-react', url: 'https://www.npmjs.com/package/lucide-react' },
        { name: 'framer-motion', url: 'https://www.npmjs.com/package/framer-motion' },
        { name: 'clsx', url: 'https://www.npmjs.com/package/clsx' },
        { name: 'tailwind-merge', url: 'https://www.npmjs.com/package/tailwind-merge' }
    ],
    devDependencies: [
        { name: '@types/react', url: 'https://www.npmjs.com/package/@types/react' },
        { name: '@types/react-dom', url: 'https://www.npmjs.com/package/@types/react-dom' },
        { name: '@vitejs/plugin-react', url: 'https://www.npmjs.com/package/@vitejs/plugin-react' },
        { name: 'autoprefixer', url: 'https://www.npmjs.com/package/autoprefixer' },
        { name: 'postcss', url: 'https://www.npmjs.com/package/postcss' },
        { name: 'tailwindcss', url: 'https://www.npmjs.com/package/tailwindcss' },
        { name: 'typescript', url: 'https://www.npmjs.com/package/typescript' },
        { name: 'vite', url: 'https://www.npmjs.com/package/vite' }
    ]
};

export const CredentialsSettingsTab: React.FC = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-3 flex items-center gap-3">
                <User className="text-dominant" size={24} />
                Credits, Attribution & Licenses
            </h2>
            <p className="text-sm text-gray-500 mb-8">References for project ownership, source code licensing, and third-party package licenses.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="p-5 rounded-2xl bg-black/20 border border-white/10">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Author</div>
                    <div className="text-sm font-bold text-white mb-2">Colin Bossu Reaubourg (Wartets)</div>
                    <a
                        href="https://wartets.github.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-dominant hover:text-dominant-light transition-colors"
                    >
                        Portfolio
                        <ExternalLink size={14} />
                    </a>
                </div>

                <div className="p-5 rounded-2xl bg-black/20 border border-white/10">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Product License</div>
                    <div className="text-sm font-bold text-white mb-2">Music Library source code is licensed under GNU GPL v3.0.</div>
                    <a
                        href="https://github.com/Wartets/Music-Library/blob/main/LICENSE"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-dominant hover:text-dominant-light transition-colors"
                    >
                        View LICENSE
                        <ExternalLink size={14} />
                    </a>
                </div>
            </div>

            <div className="p-5 rounded-2xl bg-black/20 border border-white/10 mb-8">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Music Collection Attribution Notice</div>
                <p className="text-xs text-gray-300 leading-relaxed mb-3">
                    All music on this site is provided as royalty-free for listening examples, with mandatory attribution and non-commercial use.
                </p>
                <div className="flex flex-wrap gap-3">
                    <a
                        href="https://github.com/Wartets/Music-Library"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-200 hover:bg-white/10 transition-all"
                    >
                        Source Repository
                        <ExternalLink size={12} />
                    </a>
                    <a
                        href="https://wartets.github.io/Music-Library/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-200 hover:bg-white/10 transition-all"
                    >
                        Live Site
                        <ExternalLink size={12} />
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-black/20 border border-white/10">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Runtime Dependencies License References</div>
                    <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                        {packageLicenseLinks.dependencies.map(pkg => (
                            <a
                                key={pkg.name}
                                href={pkg.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/5 text-xs text-gray-200 hover:bg-white/10 transition-colors"
                            >
                                <span className="font-bold">{pkg.name}</span>
                                <ExternalLink size={14} className="shrink-0 text-gray-500" />
                            </a>
                        ))}
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-black/20 border border-white/10">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Development Dependencies License References</div>
                    <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                        {packageLicenseLinks.devDependencies.map(pkg => (
                            <a
                                key={pkg.name}
                                href={pkg.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/5 text-xs text-gray-200 hover:bg-white/10 transition-colors"
                            >
                                <span className="font-bold">{pkg.name}</span>
                                <ExternalLink size={14} className="shrink-0 text-gray-500" />
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
);
