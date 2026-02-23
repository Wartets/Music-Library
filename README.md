# Music Library

A high-performance local music library and player designed for managing and playing a strictly organized music collection.

## Key Features

- **Local First**: Completely offline, managing your local files with low-level access.
- **Advanced Indexing**: Uses a hybrid storage model with `musicBib.json` as the Single Source of Truth.
- **High Performance**: Optimized for large libraries with instantaneous search, sorting, and filtering.
- **Audiophile Grade**: Support for Hi-Res and Lossless formats (WAV, FLAC, etc.) with gapless playback.
- **Adaptive UI**: Chameleon UI that adapts its theme based on the dominant colors of the album artwork.
- **Curation Tools**: Smart playlists, manual curation, and advanced metadata editing.

## Tech Stack

- **Frontend**: React 19, Vite, TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Drag & Drop**: @dnd-kit

## Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- A music collection structured as: `Group > Project > Folder > Audio Files`

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

### Running the App

1. Run the development server:

   ```bash
   npm run dev
   ```

2. Open your browser to the local address provided (usually `http://localhost:5173`).

## Library Structure

The library is organized into strict categories (Albums and Singles). Files are indexed via a batch script that generates `musicBib.json`.

**Note**: Music files and large folders (e.g., `Album 2`, `Album 3`, etc.) are excluded from this repository via `.gitignore` to keep the codebase lean.
