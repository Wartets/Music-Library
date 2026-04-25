# Music Library

A high-performance local music library and player designed for managing and playing a strictly organized music collection. Features an adaptive interface that responds to album artwork colors and works seamlessly across desktop and mobile devices.

## Key Features

### Core Functionality
- **Local First**: Completely offline, managing your local files with low-level access
- **Advanced Indexing**: Hybrid storage model with `musicBib.json` as the Single Source of Truth
- **High Performance**: Optimized for large libraries with instantaneous search, sorting, and filtering
- **Audiophile Grade**: Support for Hi-Res and Lossless formats (WAV, FLAC, DSD, etc.) with gapless playback
- **Adaptive UI**: Chameleon UI that adapts its theme based on the dominant colors of the album artwork

### Library Management
- **Multiple Views**: Browse by Albums, Artists, Genres, Years, Folders, and Formats
- **Smart Playlists**: Create dynamic playlists based on rules (genre, year, bitrate, etc.)
- **Manual Curation**: Create and manage custom playlists
- **Advanced Metadata**: Edit track metadata, lyrics, ratings, and artwork
- **Favorites System**: Mark and organize favorite tracks
- **Playback History**: Track and revisit recently played music
- **Duplicate Detection**: Find exact and fuzzy duplicates in your collection

### Playback
- **Queue Management**: Reorder, save, and manage playback queue
- **Audio Processing**: 10-band EQ, crossfade, and normalization
- **Multiple Versions**: Handle multiple versions of the same track (remasters, etc.)

### Mobile Support
- **Responsive Design**: Full mobile-optimized interface
- **Touch Controls**: Touch-friendly drag-and-drop queue reordering
- **Adaptive Layout**: Seamlessly transitions between mobile and desktop layouts
- **Context Menus**: Long-press support for track actions

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 19, Vite, TypeScript |
| Styling | Tailwind CSS 3.4 |
| Animations | Framer Motion |
| Icons | Lucide React |
| Drag & Drop | @dnd-kit |
| State | React Context |

## Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- A music collection structured as: `assets/Group > Project > Folder > Audio Files`

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd music-library
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

---