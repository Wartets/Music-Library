<# :
@echo off
title Music Indexer
color 0B
echo Initializing indexing...
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

# Define assets folder
$assetsFolder = "assets"
$assetsPath = Join-Path $root $assetsFolder

# Loading image library to analyze color and ratio
Add-Type -AssemblyName System.Drawing

# Supported extensions
$audioExt = @('.mp3','.wav','.flac','.m4a','.aif','.aiff','.ogg','.wma')
$losslessExt = @('.wav','.flac','.aif','.aiff')
$imgExt = @('.jpg','.jpeg','.png','.bmp','.tiff','.webp')

# Cache for shell metadata columns to avoid hardcoded indexes.
$global:metadataColumnMap = $null
$global:ffprobeTagCache = @{}
$global:ffprobeAvailable = [bool](Get-Command ffprobe -ErrorAction SilentlyContinue)

# Dictionary to cache image analysis (avoid recalculating the same image 50 times)
$global:imageCache = @{}

# Function to get a clean relative path
function Get-Rel($p, $b) {
    if (!$p) { return "" }
    $path = $p.ToString()
    $rel = $path.Replace($b, "").TrimStart("\")
    if (!$rel) { return "." }
    return $rel
}

# Normalize shell column names for robust matching across locales (FR/EN/etc).
function Normalize-DetailKey($value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return ""
    }

    $formD = $value.Normalize([Text.NormalizationForm]::FormD)
    $builder = New-Object System.Text.StringBuilder
    foreach ($char in $formD.ToCharArray()) {
        $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)
        if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$builder.Append($char)
        }
    }

    $normalized = $builder.ToString().ToLowerInvariant()
    $normalized = $normalized -replace '[^a-z0-9]+', ' '
    $normalized = ($normalized -replace '\s+', ' ').Trim()
    return $normalized
}

function Get-MetadataColumnMap($folderObject) {
    $map = @{}

    for ($i = 0; $i -le 400; $i++) {
        $columnName = $folderObject.GetDetailsOf($null, $i)
        if ([string]::IsNullOrWhiteSpace($columnName)) {
            continue
        }

        $key = Normalize-DetailKey $columnName
        if ($key -and -not $map.ContainsKey($key)) {
            $map[$key] = $i
        }
    }

    return $map
}

function Get-DetailValue {
    param(
        $FolderObject,
        $Item,
        $ColumnMap,
        [string[]]$ColumnCandidates,
        [int[]]$FallbackIndices = @()
    )

    foreach ($candidate in $ColumnCandidates) {
        $key = Normalize-DetailKey $candidate
        if ($key -and $ColumnMap.ContainsKey($key)) {
            $index = [int]$ColumnMap[$key]
            $value = [string]$FolderObject.GetDetailsOf($Item, $index)
            if (-not [string]::IsNullOrWhiteSpace($value)) {
                return $value.Trim()
            }
        }
    }

    foreach ($index in $FallbackIndices) {
        $value = [string]$FolderObject.GetDetailsOf($Item, $index)
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value.Trim()
        }
    }

    return ""
}

function Get-UniqueNormalizedValues {
    param([string[]]$Values)

    $seen = @{}
    $result = @()

    foreach ($value in $Values) {
        if ([string]::IsNullOrWhiteSpace($value)) {
            continue
        }

        $trimmed = $value.Trim()
        $key = $trimmed.ToLowerInvariant()
        if (-not $seen.ContainsKey($key)) {
            $seen[$key] = $true
            $result += $trimmed
        }
    }

    return $result
}

function Get-FFprobeTags {
    param([string]$FilePath)

    if ($global:ffprobeTagCache.ContainsKey($FilePath)) {
        return $global:ffprobeTagCache[$FilePath]
    }

    $tagsMap = @{}

    if (-not $global:ffprobeAvailable) {
        $global:ffprobeTagCache[$FilePath] = $tagsMap
        return $tagsMap
    }

    try {
        $json = & ffprobe -v quiet -print_format json -show_format -show_streams -- "$FilePath" 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($json)) {
            $probe = $json | ConvertFrom-Json

            if ($probe.format -and $probe.format.tags) {
                foreach ($property in $probe.format.tags.PSObject.Properties) {
                    $key = Normalize-DetailKey $property.Name
                    $value = [string]$property.Value
                    if ($key -and -not [string]::IsNullOrWhiteSpace($value) -and -not $tagsMap.ContainsKey($key)) {
                        $tagsMap[$key] = $value.Trim()
                    }
                }
            }

            if ($probe.streams) {
                foreach ($stream in $probe.streams) {
                    if (-not $stream.tags) { continue }
                    foreach ($property in $stream.tags.PSObject.Properties) {
                        $key = Normalize-DetailKey $property.Name
                        $value = [string]$property.Value
                        if ($key -and -not [string]::IsNullOrWhiteSpace($value) -and -not $tagsMap.ContainsKey($key)) {
                            $tagsMap[$key] = $value.Trim()
                        }
                    }
                }
            }
        }
    } catch {
        # Keep empty tag map if ffprobe fails for this file.
    }

    $global:ffprobeTagCache[$FilePath] = $tagsMap
    return $tagsMap
}

function Get-TagValue {
    param(
        $TagMap,
        [string[]]$TagCandidates
    )

    foreach ($candidate in $TagCandidates) {
        $key = Normalize-DetailKey $candidate
        if ($key -and $TagMap.ContainsKey($key)) {
            $value = [string]$TagMap[$key]
            if (-not [string]::IsNullOrWhiteSpace($value)) {
                return $value.Trim()
            }
        }
    }

    return ""
}

# Normalize artist metadata into a stable string array.
function Get-NormalizedArtists($rawValue) {
    $rawText = [string]$rawValue
    if ([string]::IsNullOrWhiteSpace($rawText)) {
        return @()
    }

    $tokens = $rawText -split '\s*(?:;|\||/|,|\bfeat\.?\b|\bfeaturing\b|\bft\.?\b)\s*'
    $artists = @(
        $tokens |
            ForEach-Object { $_.Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Select-Object -Unique
    )

    return $artists
}

# Function to deeply analyze an image (Color, Ratio, Dimensions)
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
        
        # Determine aspect ratio
        if ($width -eq $height) { $ratio = "Square" }
        elseif ($width -gt $height) { $ratio = "Landscape" }
        else { $ratio = "Portrait" }
        
        # Determine dominant color (by reducing image to 1x1 pixel)
        $1x1 = New-Object System.Drawing.Bitmap($bmp, 1, 1)
        $color = $1x1.GetPixel(0, 0)
        $hexColor = "#{0:X2}{1:X2}{2:X2}" -f $color.R, $color.G, $color.B
        
        # Free memory
        $1x1.Dispose()
        $bmp.Dispose()
    } catch {
        Write-Warning "Unable to read image data: $imgPath"
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

# audio files
$files = Get-ChildItem -Path $assetsPath -Recurse -File | Where-Object { $audioExt -contains $_.Extension.ToLower() }
$total = $files.Count
$results = [System.Collections.Generic.List[PSCustomObject]]::new()
$timer = [System.Diagnostics.Stopwatch]::StartNew()

if ($total -eq 0) {
    Write-Progress -Activity "Creating music database" -Status "No audio files found" -Completed
} else {
    $workerScript = {
        param($FileData, $Root, $AudioExt, $LosslessExt, $ImgExt)

        Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue | Out-Null
        $shell = New-Object -ComObject Shell.Application
        $metadataColumnMap = $null
        $imageCache = @{}

        function Get-Rel($p, $b) {
            if (!$p) { return "" }
            $path = $p.ToString()
            $rel = $path.Replace($b, "").TrimStart("\\")
            if (!$rel) { return "." }
            return $rel
        }

        function Normalize-DetailKey($value) {
            if ([string]::IsNullOrWhiteSpace($value)) {
                return ""
            }

            $formD = $value.Normalize([Text.NormalizationForm]::FormD)
            $builder = New-Object System.Text.StringBuilder
            foreach ($char in $formD.ToCharArray()) {
                $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)
                if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
                    [void]$builder.Append($char)
                }
            }

            $normalized = $builder.ToString().ToLowerInvariant()
            $normalized = $normalized -replace '[^a-z0-9]+', ' '
            $normalized = ($normalized -replace '\\s+', ' ').Trim()
            return $normalized
        }

        function Get-MetadataColumnMap($folderObject) {
            $map = @{}
            for ($i = 0; $i -le 400; $i++) {
                $columnName = $folderObject.GetDetailsOf($null, $i)
                if ([string]::IsNullOrWhiteSpace($columnName)) {
                    continue
                }

                $key = Normalize-DetailKey $columnName
                if ($key -and -not $map.ContainsKey($key)) {
                    $map[$key] = $i
                }
            }
            return $map
        }

        function Get-DetailValue {
            param(
                $FolderObject,
                $Item,
                $ColumnMap,
                [string[]]$ColumnCandidates,
                [int[]]$FallbackIndices = @()
            )

            foreach ($candidate in $ColumnCandidates) {
                $key = Normalize-DetailKey $candidate
                if ($key -and $ColumnMap.ContainsKey($key)) {
                    $index = [int]$ColumnMap[$key]
                    $value = [string]$FolderObject.GetDetailsOf($Item, $index)
                    if (-not [string]::IsNullOrWhiteSpace($value)) {
                        return $value.Trim()
                    }
                }
            }

            foreach ($index in $FallbackIndices) {
                $value = [string]$FolderObject.GetDetailsOf($Item, $index)
                if (-not [string]::IsNullOrWhiteSpace($value)) {
                    return $value.Trim()
                }
            }

            return ""
        }

        function Get-UniqueNormalizedValues {
            param([string[]]$Values)

            $seen = @{}
            $result = @()

            foreach ($value in $Values) {
                if ([string]::IsNullOrWhiteSpace($value)) {
                    continue
                }

                $trimmed = $value.Trim()
                $key = $trimmed.ToLowerInvariant()
                if (-not $seen.ContainsKey($key)) {
                    $seen[$key] = $true
                    $result += $trimmed
                }
            }

            return $result
        }

        function Get-FFprobeTags {
            param([string]$FilePath)

            $tagsMap = @{}
            $ffprobeAvailable = [bool](Get-Command ffprobe -ErrorAction SilentlyContinue)
            if (-not $ffprobeAvailable) {
                return $tagsMap
            }

            try {
                $json = & ffprobe -v quiet -print_format json -show_format -show_streams -- "$FilePath" 2>$null
                if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($json)) {
                    $probe = $json | ConvertFrom-Json

                    if ($probe.format -and $probe.format.tags) {
                        foreach ($property in $probe.format.tags.PSObject.Properties) {
                            $key = Normalize-DetailKey $property.Name
                            $value = [string]$property.Value
                            if ($key -and -not [string]::IsNullOrWhiteSpace($value) -and -not $tagsMap.ContainsKey($key)) {
                                $tagsMap[$key] = $value.Trim()
                            }
                        }
                    }

                    if ($probe.streams) {
                        foreach ($stream in $probe.streams) {
                            if (-not $stream.tags) { continue }
                            foreach ($property in $stream.tags.PSObject.Properties) {
                                $key = Normalize-DetailKey $property.Name
                                $value = [string]$property.Value
                                if ($key -and -not [string]::IsNullOrWhiteSpace($value) -and -not $tagsMap.ContainsKey($key)) {
                                    $tagsMap[$key] = $value.Trim()
                                }
                            }
                        }
                    }
                }
            } catch {
                # Keep empty tag map when ffprobe fails for this file.
            }

            return $tagsMap
        }

        function Get-TagValue {
            param(
                $TagMap,
                [string[]]$TagCandidates
            )

            foreach ($candidate in $TagCandidates) {
                $key = Normalize-DetailKey $candidate
                if ($key -and $TagMap.ContainsKey($key)) {
                    $value = [string]$TagMap[$key]
                    if (-not [string]::IsNullOrWhiteSpace($value)) {
                        return $value.Trim()
                    }
                }
            }

            return ""
        }

        function Get-NormalizedArtists($rawValue) {
            $rawText = [string]$rawValue
            if ([string]::IsNullOrWhiteSpace($rawText)) {
                return @()
            }

            $tokens = $rawText -split '\\s*(?:;|\\||/|,|\\bfeat\\.?\\b|\\bfeaturing\\b|\\bft\\.?\\b)\\s*'
            $artists = @(
                $tokens |
                    ForEach-Object { $_.Trim() } |
                    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
                    Select-Object -Unique
            )

            return $artists
        }

        function Get-ImageDetails($imgPath) {
            if ($imageCache.ContainsKey($imgPath)) {
                return $imageCache[$imgPath]
            }

            $fileInfo = Get-Item -LiteralPath $imgPath
            $width = 0; $height = 0; $ratio = "Unknown"; $hexColor = "#000000"
            
            try {
                $bmp = New-Object System.Drawing.Bitmap($imgPath)
                $width = $bmp.Width
                $height = $bmp.Height
                
                if ($width -eq $height) { $ratio = "Square" }
                elseif ($width -gt $height) { $ratio = "Landscape" }
                else { $ratio = "Portrait" }
                
                $oneByOne = New-Object System.Drawing.Bitmap($bmp, 1, 1)
                $color = $oneByOne.GetPixel(0, 0)
                $hexColor = "#{0:X2}{1:X2}{2:X2}" -f $color.R, $color.G, $color.B
                
                $oneByOne.Dispose()
                $bmp.Dispose()
            } catch {
                # Keep default metadata when image analysis fails.
            }

            $result = [ordered]@{
                name = $fileInfo.Name
                type = $fileInfo.Extension.Replace('.','').ToUpper()
                path = Get-Rel $imgPath $Root
                size_bytes = $fileInfo.Length
                dimensions = "$width x $height"
                aspect_ratio = $ratio
                dominant_color = $hexColor
            }

            $imageCache[$imgPath] = $result
            return $result
        }

        $f = Get-Item -LiteralPath $FileData.FullName
        $fObj = $shell.NameSpace($f.DirectoryName)
        $item = $fObj.ParseName($f.Name)

        $relDir = Get-Rel $f.DirectoryName $Root
        $parts = $relDir -split '\\'

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

        $trackVersionsCount = (Get-ChildItem -Path $f.DirectoryName -File | Where-Object { $AudioExt -contains $_.Extension.ToLower() }).Count
        $fileHash = (Get-FileHash -Path $f.FullName -Algorithm SHA256).Hash

        $trackArtworks = @()
        $albumArtworks = @()

        $trackArtworksRaw = Get-ChildItem -Path $f.DirectoryName -File | Where-Object { $ImgExt -contains $_.Extension.ToLower() }
        $trackArtworksRaw | Sort-Object {
            if ($_.BaseName -ieq "artwork") { 0 }
            elseif ($_.BaseName -ieq "folder") { 1 }
            elseif ($_.BaseName -ieq "albumartsmall") { 2 }
            else { 3 }
        } | ForEach-Object {
            $trackArtworks += Get-ImageDetails $_.FullName
        }

        if ($f.Directory.Parent -and $f.Directory.Parent.FullName -ne $Root) {
            $albumArtworksRaw = Get-ChildItem -Path $f.Directory.Parent.FullName -File | Where-Object { $ImgExt -contains $_.Extension.ToLower() }
            $albumArtworksRaw | Sort-Object {
                if ($_.BaseName -ieq "artwork") { 0 }
                elseif ($_.BaseName -ieq "folder") { 1 }
                elseif ($_.BaseName -ieq "albumartsmall") { 2 }
                else { 3 }
            } | ForEach-Object {
                $albumArtworks += Get-ImageDetails $_.FullName
            }
        }

        if (-not $metadataColumnMap) {
            $metadataColumnMap = Get-MetadataColumnMap $fObj
        }

        $ffTags = Get-FFprobeTags -FilePath $f.FullName

        $rawArt = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @(
            'Contributing artists', 'Artist', 'Artists', 'Participating artists', 'Album artists',
            'Artiste', 'Artistes', 'Artistes participants', 'Interpretes'
        ) -FallbackIndices @(13)
        $ffArtist = Get-TagValue -TagMap $ffTags -TagCandidates @('artist', 'artists', 'performer', 'album_artist')
        $artists = Get-UniqueNormalizedValues @(
            (Get-NormalizedArtists $ffArtist)
            (Get-NormalizedArtists $rawArt)
        )

        $metaTitleShell = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Title', 'Titre') -FallbackIndices @(21)
        $metaTitleFf = Get-TagValue -TagMap $ffTags -TagCandidates @('title')
        $metaTitle = if ($metaTitleShell) { $metaTitleShell } elseif ($metaTitleFf) { $metaTitleFf } else { $f.BaseName }

        $metaAlbumShell = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Album') -FallbackIndices @(14)
        $metaAlbumFf = Get-TagValue -TagMap $ffTags -TagCandidates @('album')
        $metaAlbum = if ($metaAlbumShell) { $metaAlbumShell } elseif ($metaAlbumFf) { $metaAlbumFf } else { $album }

        $metaAlbumArtist = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Album artist', 'Album artists', 'Artiste de l album')
        $metaAlbumArtistFf = Get-TagValue -TagMap $ffTags -TagCandidates @('album_artist', 'albumartist')
        if (-not $metaAlbumArtist) {
            $metaAlbumArtist = $metaAlbumArtistFf
        }

        $metaComposerShell = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Composer', 'Compositeur') -FallbackIndices @(223, 243)
        $metaComposerFf = Get-TagValue -TagMap $ffTags -TagCandidates @('composer')
        $metaComposer = if ($metaComposerShell) { $metaComposerShell } elseif ($metaComposerFf) { $metaComposerFf } else { "" }

        $metaGenreShell = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Genre') -FallbackIndices @(16)
        $metaGenreFf = Get-TagValue -TagMap $ffTags -TagCandidates @('genre')
        $metaGenre = if ($metaGenreShell) { $metaGenreShell } elseif ($metaGenreFf) { $metaGenreFf } else { "" }

        $metaYearShell = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Year', 'Annee', 'Date') -FallbackIndices @(15)
        $metaYearFf = Get-TagValue -TagMap $ffTags -TagCandidates @('date', 'year')
        $metaYear = if ($metaYearShell) { $metaYearShell } elseif ($metaYearFf) { $metaYearFf } else { "" }

        $metaTrackNumberShell = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Track number', 'Numero de piste', '#') -FallbackIndices @(26)
        $metaTrackNumberFf = Get-TagValue -TagMap $ffTags -TagCandidates @('track', 'tracknumber')
        $metaTrackNumber = if ($metaTrackNumberShell) { $metaTrackNumberShell } elseif ($metaTrackNumberFf) { $metaTrackNumberFf } else { "" }

        $metaTotalTracks = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Track count', 'Total tracks', 'Nombre total de pistes')
        if (-not $metaTotalTracks) {
            $metaTotalTracks = Get-TagValue -TagMap $ffTags -TagCandidates @('tracktotal', 'totaltracks')
        }

        $metaDiscNumber = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Disc number', 'Numero de disque')
        if (-not $metaDiscNumber) {
            $metaDiscNumber = Get-TagValue -TagMap $ffTags -TagCandidates @('disc', 'discnumber')
        }

        $metaTotalDiscs = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Total discs', 'Nombre total de disques')
        if (-not $metaTotalDiscs) {
            $metaTotalDiscs = Get-TagValue -TagMap $ffTags -TagCandidates @('disctotal', 'totaldiscs')
        }

        $metaLyrics = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Lyrics', 'Paroles')
        if (-not $metaLyrics) {
            $metaLyrics = Get-TagValue -TagMap $ffTags -TagCandidates @('lyrics', 'unsyncedlyrics')
        }

        $metaBpm = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Beats-per-minute', 'Beats per minute', 'BPM') -FallbackIndices @(312)
        if (-not $metaBpm) {
            $metaBpm = Get-TagValue -TagMap $ffTags -TagCandidates @('bpm', 'tbpm')
        }

        $metaComment = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Comments', 'Comment', 'Commentaires') -FallbackIndices @(24)
        if (-not $metaComment) {
            $metaComment = Get-TagValue -TagMap $ffTags -TagCandidates @('comment', 'description')
        }

        $metaDescription = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Description') -FallbackIndices @(219)
        if (-not $metaDescription) {
            $metaDescription = Get-TagValue -TagMap $ffTags -TagCandidates @('description')
        }

        if (-not $metaAlbumArtist) {
            $metaAlbumArtist = if ($rawArt) { $rawArt } else { $ffArtist }
        }

        if ($artists.Count -eq 0 -and $metaAlbumArtist) {
            $artists = Get-NormalizedArtists $metaAlbumArtist
        }

        if ($metaComposer) {
            $artists = Get-UniqueNormalizedValues @(
                $artists
                (Get-NormalizedArtists $metaComposer)
            )
        }

        $epochCreated = [int][double]::Parse((Get-Date $f.CreationTime -UFormat %s))
        $epochModified = [int][double]::Parse((Get-Date $f.LastWriteTime -UFormat %s))

        $indexedItem = [ordered]@{
            id = $FileData.Index + 1
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
                path = Get-Rel $f.FullName $Root
                dir = $relDir
                size_bytes = $f.Length
                size_mb = [math]::Round($f.Length / 1MB, 2)
                created = $f.CreationTime.ToString("yyyy-MM-dd HH:mm:ss")
                modified = $f.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
                epoch_created = $epochCreated
                epoch_modified = $epochModified
            }
            metadata = [ordered]@{
                title = $metaTitle
                file_title = $f.BaseName
                file_name = $f.Name
                artists = @($artists)
                album_artist = $metaAlbumArtist
                composer = $metaComposer
                album = $metaAlbum
                genre = $metaGenre
                year = $metaYear
                track_number = $metaTrackNumber
                total_tracks = $metaTotalTracks
                disc_number = $metaDiscNumber
                total_discs = $metaTotalDiscs
                bpm = $metaBpm
                lyrics = $metaLyrics
                comment = $metaComment
                description = $metaDescription
            }
            audio_specs = [ordered]@{
                is_lossless = ($LosslessExt -contains $f.Extension.ToLower())
                duration = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Length', 'Duration', 'Duree') -FallbackIndices @(27)
                bitrate = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Bit rate', 'Bitrate', 'Debit binaire') -FallbackIndices @(28)
                sample_rate = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Sample rate', 'Frequence d echantillonnage') -FallbackIndices @(316)
                channels = Get-DetailValue -FolderObject $fObj -Item $item -ColumnMap $metadataColumnMap -ColumnCandidates @('Channels', 'Canaux') -FallbackIndices @(311)
            }
            artworks = [ordered]@{
                track_artwork = $trackArtworks
                album_artwork = $albumArtworks
            }
        }

        [pscustomobject]@{
            index = [int]$FileData.Index
            item = $indexedItem
            filename = $f.Name
        }
    }

    $maxThreads = [Math]::Min([Math]::Max([Environment]::ProcessorCount, 2), 12)
    Write-Host "Using $maxThreads parallel workers for indexing..." -ForegroundColor Cyan

    $fileWorkItems = for ($i = 0; $i -lt $total; $i++) {
        [pscustomobject]@{
            Index = $i
            FullName = $files[$i].FullName
        }
    }

    $runspacePool = [RunspaceFactory]::CreateRunspacePool(1, $maxThreads)
    $runspacePool.Open()

    $tasks = New-Object System.Collections.Generic.List[object]
    $indexedEntries = New-Object System.Collections.Generic.List[object]

    foreach ($workItem in $fileWorkItems) {
        $ps = [PowerShell]::Create()
        $ps.RunspacePool = $runspacePool
        $null = $ps.AddScript($workerScript).AddArgument($workItem).AddArgument($root).AddArgument($audioExt).AddArgument($losslessExt).AddArgument($imgExt)

        $handle = $ps.BeginInvoke()
        $tasks.Add([pscustomobject]@{
            PowerShell = $ps
            Handle = $handle
            Index = $workItem.Index
        })
    }

    $processed = 0

    try {
        while ($tasks.Count -gt 0) {
            for ($t = $tasks.Count - 1; $t -ge 0; $t--) {
                $task = $tasks[$t]
                if (-not $task.Handle.IsCompleted) {
                    continue
                }

                try {
                    $workerOutput = $task.PowerShell.EndInvoke($task.Handle)
                    if ($workerOutput) {
                        foreach ($outputItem in $workerOutput) {
                            $indexedEntries.Add($outputItem)
                        }
                    }
                } catch {
                    $filePath = $files[$task.Index].FullName
                    Write-Warning "Failed indexing file: $filePath"
                    Write-Warning $_.Exception.Message
                } finally {
                    $completedFileName = $files[$task.Index].Name
                    $task.PowerShell.Dispose()
                    $tasks.RemoveAt($t)
                    $processed++
                    $pct = ($processed / $total) * 100
                    Write-Progress -Activity "Creating music database" -Status "Analyzing [$processed/$total] : $completedFileName" -PercentComplete $pct
                }
            }

            if ($tasks.Count -gt 0) {
                Start-Sleep -Milliseconds 40
            }
        }
    } finally {
        Write-Progress -Activity "Creating music database" -Completed
        $runspacePool.Close()
        $runspacePool.Dispose()
    }

    $orderedIndexedEntries = $indexedEntries | Sort-Object { [int]$_.index }
    foreach ($entry in $orderedIndexedEntries) {
        $results.Add($entry.item)
    }
}

$timer.Stop()

# Creation of the root global object
$finalData = [ordered]@{
    info = [ordered]@{
        date = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        total_tracks_versions = $total
        execution_time_ms = $timer.ElapsedMilliseconds
    }
    items = $results
}

# Convert to raw JSON (generates 4 spaces indentation by default)
$rawJsonLines = ($finalData | ConvertTo-Json -Depth 20) -split "`r?`n"

# JSON INDENTATION OPTIMIZATION TO 1 SPACE (ALGORITHM)
Write-Host "`nOptimizing JSON formatting (Strict 1 space indentation)..." -ForegroundColor Cyan
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

# Final save in clean UTF-8
[System.IO.File]::WriteAllLines($output, $optimizedJson, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "`n[SUCCESS] Database $output generated successfully!" -ForegroundColor Green
Write-Host "$total versions indexed in $($timer.Elapsed.TotalSeconds) seconds." -ForegroundColor Green