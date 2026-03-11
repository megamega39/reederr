function calculateAncestors(path: string, treeRoots: {name: string, path: string}[], favorites: {name: string, path: string}[]) {
  const normPath = path.toLowerCase().replace(/\\/g, '/');
  
  // Candidates: Favorites first, then Special Folders (which includes Downloads), then PC
  const candidates = [
    ...favorites,
    ...treeRoots.filter(r => r.path !== 'pc')
  ];

  let bestMatch: { name: string, path: string } | null = null;
  // Use first match that works, because we prioritized the array
  for (const cand of candidates) {
    const normCand = cand.path.toLowerCase().replace(/\\/g, '/');
    const normCandWithSlash = normCand.endsWith('/') ? normCand : normCand + '/';

    if (normPath === normCand || normPath.startsWith(normCandWithSlash)) {
      // Since candidates are strictly prioritized (Favorites > Special Folders), we prefer the first valid one we find
      // BUT we also want the deepest/longest match...
      
      // If we find a match, only override it if the new match is strictly longer length
      // Because array is ordered by priority, we only override if it's a sub-directory of the current best match.
      if (!bestMatch || cand.path.length > bestMatch.path.length) {
        bestMatch = cand;
      }
    }
  }

  return bestMatch;
}

const treeRoots = [
  { name: 'デスクトップ', path: 'C:\\Users\\megam\\Desktop' },
  { name: 'ダウンロード', path: 'C:\\Users\\megam\\Downloads' }
];

const favorites = [
  { name: 'お気に入りフォルダ', path: 'C:\\Users\\megam\\Downloads\\TestFolder' }
];

console.log(calculateAncestors('C:\\Users\\megam\\Downloads\\TestFolder\\Sub', treeRoots, favorites));
// Should pick "Download/TestFolder" (Favorite) over "Downloads" (Special)

console.log(calculateAncestors('C:\\Users\\megam\\Downloads\\OtherFolder', treeRoots, favorites));
// Should pick "Downloads"
