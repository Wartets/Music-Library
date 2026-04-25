<# :
@echo off
title Music Indexer
color 0B
echo Initialisation de l'indexation avec analyse profonde...
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; iex (Get-Content '%~f0' -Raw -Encoding UTF8)"
pause
exit /b
#>

$root = Get-Location | Select-Object -ExpandProperty Path
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$output = Join-Path $root "musicBib.json"
$shell = New-Object -ComObject Shell.Application

# Define assets folder - all music files are under assets/
$assetsFolder = "assets"
$assetsPath = Join-Path $root $assetsFolder

# Chargement de la librairie d'images pour analyser la couleur et le ratio
Add-Type -AssemblyName System.Drawing

# Extensions supportees
$audioExt = @('.mp3','.wav','.flac','.m4a','.aif','.aiff','.ogg','.wma')
$losslessExt = @('.wav','.flac','.aif','.aiff')
$imgExt = @('.jpg','.jpeg','.png','.bmp','.tiff','.webp')

# Informations du proprietaire
$ownerInfo = [ordered]@{
    first_name = "Colin"
    last_name = "Bossu Réaubourg"
    nickname = "Wartets"
    full_name = "Colin Bossu Réaubourg"
}

# Dictionnaire pour mettre en cache l'analyse des images (evite de recalculer la meme image 50 fois)
$global:imageCache = @{}

# Fonction pour obtenir un chemin relatif propre
function Get-Rel($p, $b) {
    if (!$p) { return "" }
    $path = $p.ToString()
    $rel = $path.Replace($b, "").TrimStart("\")
    if (!$rel) { return "." }
    return $rel
}

# Fonction pour analyser profondement une image (Couleur, Ratio, Dimensions)
function Get-ImageDetails($imgPath) {
    if ($global:imageCache.ContainsKey($imgPath)) {
        return $global:imageCache[$imgPath]
    }

    $fileInfo = Get-Item $imgPath
    $width = 0; $height = 0; $ratio = "Unknown"; $hexColor = "#000000"
    
    try {
        $bmp = New-Object System.Drawing.Bitmap($imgPath)
        $width = $bmp.Width
        $height = $bmp.Height
        
        # Determine l'aspect ratio
        if ($width -eq $height) { $ratio = "Square" }
        elseif ($width -gt $height) { $ratio = "Landscape" }
        else { $ratio = "Portrait" }
        
        # Determine la couleur dominante (en reduisant l'image a 1x1 pixel)
        $1x1 = New-Object System.Drawing.Bitmap($bmp, 1, 1)
        $color = $1x1.GetPixel(0, 0)
        $hexColor = "#{0:X2}{1:X2}{2:X2}" -f $color.R, $color.G, $color.B
        
        # Liberation de la memoire
        $1x1.Dispose()
        $bmp.Dispose()
    } catch {
        Write-Warning "Impossible de lire les donnees de l'image : $imgPath"
    }

    $result = [ordered]@{
        name = $fileInfo.Name
        type = $fileInfo.Extension.Replace('.','').ToUpper()
        path = Get-Rel $imgPath $root
        size_bytes = $fileInfo.Length
        dimensions = "$width x $height"
        aspect_ratio = $ratio
        dominant_color = $hexColor
    }
    
    $global:imageCache[$imgPath] = $result
    return $result
}

# fichiers audio
$files = Get-ChildItem -Path $assetsPath -Recurse -File | Where-Object { $audioExt -contains $_.Extension.ToLower() }
$total = $files.Count
$results = [System.Collections.Generic.List[PSCustomObject]]::new()
$timer = [System.Diagnostics.Stopwatch]::StartNew()

for ($i = 0; $i -lt $total; $i++) {
    $f = $files[$i]
    $pct = (($i + 1) / $total) * 100
    Write-Progress -Activity "Creation de la base de donnees musicale" -Status "Analyse [$($i+1)/$total] : $($f.Name)" -PercentComplete $pct

    $fObj = $shell.NameSpace($f.DirectoryName)
    $item = $fObj.ParseName($f.Name)
    
    # -- 1. ANALYSE DE LA HIeRARCHIE --
    $relDir = Get-Rel $f.DirectoryName $root
    $parts = $relDir -split '\\'
    
    # Skip 'assets' root folder if present
    if ($parts.Count -gt 0 -and $parts[0] -ieq 'assets') {
        $parts = $parts[1..($parts.Count-1)]
    }
    
    $isSingle = $false
    $group = $null
    $album = $null
    $trackFolder = $null

    if ($parts.Count -gt 0) {
        if ($parts[0] -match "(?i)^Single$") {
            $isSingle = $true
            $group = "Single"
            if ($parts.Count -ge 2) { $trackFolder = $parts[1] }
        } else {
            if ($parts.Count -eq 1) {
                $group = $parts[0]
            } elseif ($parts.Count -eq 2) {
                $group = $parts[0]
                $trackFolder = $parts[1]
            } else {
                $group = $parts[0]
                $album = $parts[1]
                $trackFolder = $parts[2]
            }
        }
    }

    # -- 2. CALCULS AVANCeS (COMPTEUR, HASH) --
    # Compte le nombre de versions dans ce dossier specifique
    $trackVersionsCount = (Get-ChildItem -Path $f.DirectoryName -File | Where-Object { $audioExt -contains $_.Extension.ToLower() }).Count
    
    # Empreinte unique du fichier (SHA256)
    $fileHash = (Get-FileHash -Path $f.FullName -Algorithm SHA256).Hash

    # -- 3. GESTION DES ARTWORKS (AVEC COULEUR ET RATIO) --
    $trackArtworks = @()
    $albumArtworks = @()

    # Artworks du morceau (dans le dossier même)
    $trackArtworksRaw = Get-ChildItem -Path $f.DirectoryName -File | Where-Object { $imgExt -contains $_.Extension.ToLower() }
    $trackArtworksRaw | Sort-Object { if ($_.BaseName -ieq "artwork") { 0 } else { 1 } } | ForEach-Object {
        $trackArtworks += Get-ImageDetails $_.FullName
    }

    # Artworks de l'album (dossier parent)
    if ($album -ne $null -and $f.Directory.Parent -and $f.Directory.Parent.FullName -ne $root) {
        $albumArtworksRaw = Get-ChildItem -Path $f.Directory.Parent.FullName -File | Where-Object { $imgExt -contains $_.Extension.ToLower() }
        $albumArtworksRaw | Sort-Object { if ($_.BaseName -ieq "artwork") { 0 } else { 1 } } | ForEach-Object {
            $albumArtworks += Get-ImageDetails $_.FullName
        }
    }

    # -- 4. EXTRACTION DES MeTADONNeES AVEC VALEURS PAR DeFAUT --
    $rawArt = $fObj.GetDetailsOf($item, 13)
    $artists = if ($rawArt) { $rawArt.Split(';') | ForEach-Object { $_.Trim() } | Where-Object { $_ } } else { @($ownerInfo.full_name) }
    
    $metaTitle = $fObj.GetDetailsOf($item, 21)
    $metaAlbum = $fObj.GetDetailsOf($item, 14)
    $metaComposer = $fObj.GetDetailsOf($item, 223)
    
    if (!$metaComposer) { $metaComposer = $ownerInfo.full_name }

    # Format de temps Unix (Epoch) pour la future application
    $epochCreated = [int][double]::Parse((Get-Date $f.CreationTime -UFormat %s))
    $epochModified = [int][double]::Parse((Get-Date $f.LastWriteTime -UFormat %s))

    # -- 5. CONSTRUCTION DE L'OBJET FINAL --
    $results.Add([ordered]@{
        id = $i + 1
        logic = [ordered]@{
            hash_sha256 = $fileHash
            track_name = if ($trackFolder) { $trackFolder } else { $f.BaseName }
            version_name = $f.BaseName
            total_versions_in_folder = $trackVersionsCount
            is_single = $isSingle
            hierarchy = [ordered]@{
                group = $group
                album = $album
                folder = $trackFolder
            }
        }
        file = [ordered]@{
            name = $f.Name
            ext = $f.Extension.Replace('.','').ToUpper()
            path = Get-Rel $f.FullName $root
            dir = $relDir
            size_bytes = $f.Length
            size_mb = [math]::Round($f.Length / 1MB, 2)
            created = $f.CreationTime.ToString("yyyy-MM-dd HH:mm:ss")
            modified = $f.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
            epoch_created = $epochCreated
            epoch_modified = $epochModified
        }
        metadata = [ordered]@{
            title = if ($metaTitle) { $metaTitle } else { $f.BaseName }
            artists = $artists
            album_artist = if ($fObj.GetDetailsOf($item, 13)) { $fObj.GetDetailsOf($item, 13) } else { $ownerInfo.full_name }
            composer = $metaComposer
            album = if ($metaAlbum) { $metaAlbum } else { $album }
            genre = $fObj.GetDetailsOf($item, 16)
            year = $fObj.GetDetailsOf($item, 15)
            track_number = $fObj.GetDetailsOf($item, 26)
            bpm = $fObj.GetDetailsOf($item, 312)
            comment = $fObj.GetDetailsOf($item, 24)
            description = $fObj.GetDetailsOf($item, 219)
        }
        audio_specs = [ordered]@{
            is_lossless = ($losslessExt -contains $f.Extension.ToLower())
            duration = $fObj.GetDetailsOf($item, 27)
            bitrate = $fObj.GetDetailsOf($item, 28)
            sample_rate = $fObj.GetDetailsOf($item, 316)
            channels = $fObj.GetDetailsOf($item, 311)
        }
        artworks = [ordered]@{
            track_artwork = $trackArtworks
            album_artwork = $albumArtworks
        }
    })
}

$timer.Stop()

# Creation de l'objet global racine
$finalData = [ordered]@{
    info = [ordered]@{
        owner = $ownerInfo
        date = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        total_tracks_versions = $total
        execution_time_ms = $timer.ElapsedMilliseconds
    }
    items = $results
}

# Conversion en JSON brut (qui genere 4 espaces d'indentation par defaut)
$rawJsonLines = ($finalData | ConvertTo-Json -Depth 20) -split "`r?`n"

# -- OPTIMISATION DE L'INDENTATION A 1 ESPACE (ALGORITHME) --
Write-Host "`nOptimisation du formatage JSON (Indentation sticte a 1 espace)..." -ForegroundColor Cyan
$optimizedJson = foreach ($line in $rawJsonLines) {
    if ($line -match '^(\s+)(.*)$') {
        # Recupere le nombre d'espaces actuels, le divise par 4 (standard PowerShell), ou met 1
        $currentSpaces = $matches[1].Length
        $newIndentLevel = [math]::Floor($currentSpaces / 4)
        if ($newIndentLevel -le 0) { $newIndentLevel = 1 }
        
        $newIndent = " " * $newIndentLevel
        $newIndent + $matches[2]
    } else {
        $line
    }
}

# Sauvegarde finale en UTF-8 propre
[System.IO.File]::WriteAllLines($output, $optimizedJson, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "`n[SUCCES] Base de donnees $output generee avec succes !" -ForegroundColor Green
Write-Host "$total versions indexees en $($timer.Elapsed.TotalSeconds) secondes." -ForegroundColor Green