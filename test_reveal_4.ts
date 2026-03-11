function calculateAncestors(path: string, candidates: {name: string, path: string, type: string}[]) {
  const normPath = path.toLowerCase().replace(/\\/g, '/');
  let bestMatch: { name: string, path: string, type: string } | null = null;

  for (const cand of candidates) {
    const normCand = cand.path.toLowerCase().replace(/\\/g, '/');
    const normCandWithSlash = normCand.endsWith('/') ? normCand : normCand + '/';

    if (normPath === normCand || normPath.startsWith(normCandWithSlash)) {
      if (!bestMatch || cand.path.length > bestMatch.path.length) {
        bestMatch = cand;
      } else if (cand.path.length === bestMatch.path.length && cand.type === 'favorite') {
        bestMatch = cand;
      }
    }
  }

  let ancestors: string[] = [];

  if (bestMatch) {
    // Priority 1 & 2: Favorites and Special Folders
    // ONLY include the bestMatch path, and subsequent child paths. 
    // DO NOT include PC or C:\ or any parent directories of bestMatch.
    ancestors.push(bestMatch.path);
    
    // We only process the remaining path, appending it to bestMatch.path
    const remainingPath = path.slice(bestMatch.path.length);
    if (remainingPath) {
      const parts = remainingPath.split(/([/\\]|!)/).filter(p => p !== '');
      let current = bestMatch.path;
      for (const part of parts) {
        current += part;
        const isSeparator = part === '\\' || part === '/' || part === '!';
        if (!isSeparator && current !== bestMatch.path) {
          ancestors.push(current);
        }
      }
    }
  } else {
    // Priority 3: PC
    if (path.includes(':') || path.startsWith('\\') || path.startsWith('/')) {
      ancestors.push('pc');
      const parts = path.split(/([/\\]|!)/).filter(p => p !== '');
      let current = '';
      for (const part of parts) {
        current += part;
        const isSeparator = part === '\\' || part === '/' || part === '!';
        const isDriveRoot = /^[a-zA-Z]:[/\\]$/.test(current);
        
        if (isDriveRoot) {
          ancestors.push(current);
        } else if (!isSeparator) {
          ancestors.push(current);
        }
      }
    }
  }
  
  // Deduplicate array
  ancestors = Array.from(new Set(ancestors));
  return { bestMatch, ancestors };
}

const candidates = [
  { name: 'デスクトップ', path: 'C:\\Users\\megam\\Desktop', type: 'special' },
  { name: 'ダウンロード', path: 'C:\\Users\\megam\\Downloads', type: 'special' },
  { name: 'fav', path: 'C:\\Users\\megam\\Downloads\\fav', type: 'favorite' }
];

console.log("TEST 1: Subfolder in Special");
console.log(calculateAncestors('C:\\Users\\megam\\Downloads\\TestFolder\\Sub', candidates).ancestors);

console.log("TEST 2: Subfolder in Favorite");
console.log(calculateAncestors('C:\\Users\\megam\\Downloads\\fav\\abc', candidates).ancestors);

console.log("TEST 3: PC Fallback");
console.log(calculateAncestors('D:\\Manga\\Naruto', candidates).ancestors);
