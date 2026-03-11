import { fileURLToPath } from 'url';

function calculateAncestors(path: string, candidates: {name: string, path: string}[]) {
  const normPath = path.toLowerCase().replace(/\\/g, '/');
  let bestMatch: { name: string, path: string } | null = null;

  for (const cand of candidates) {
    const normCand = cand.path.toLowerCase().replace(/\\/g, '/');
    const normCandWithSlash = normCand.endsWith('/') ? normCand : normCand + '/';

    if (normPath === normCand || normPath.startsWith(normCandWithSlash)) {
      if (!bestMatch || cand.path.length > bestMatch.path.length) {
        bestMatch = cand;
      }
    }
  }

  let ancestors: string[] = [];
  let remainingPath = '';

  if (bestMatch) {
    ancestors.push(bestMatch.path);
    remainingPath = path.slice(bestMatch.path.length);
  } else {
    if (path.includes(':') || path.startsWith('\\') || path.startsWith('/')) {
      ancestors.push('pc');
      remainingPath = path;
    }
  }

  if (remainingPath) {
    const parts = remainingPath.split(/([/\\]|!)/).filter(p => p !== '');
    let current = bestMatch ? bestMatch.path : '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      current += part;
      const isSeparator = part === '\\' || part === '/' || part === '!';
      const isDriveRoot = /^[a-zA-Z]:[/\\]$/.test(current);
      
      if (isDriveRoot) {
        // e.g., "C:\"
        ancestors.push(current);
      } else if (!isSeparator && current !== bestMatch?.path) {
        // e.g., "C:\Manga", "C:\Users\megam\Downloads\TestFolder"
        // Avoid pushing bestMatch.path again if it somehow got pushed.
        // Wait, if current is bestMatch.path, it was already pushed before.
        ancestors.push(current);
      }
    }
  }
  
  // Deduplicate array
  ancestors = Array.from(new Set(ancestors));
  return { bestMatch, ancestors };
}

const candidates = [
  { name: 'デスクトップ', path: 'C:\\Users\\megam\\Desktop' },
  { name: 'ダウンロード', path: 'C:\\Users\\megam\\Downloads' }
];

console.log("TEST 1: Inside Downloads");
console.log(calculateAncestors('C:\\Users\\megam\\Downloads\\TestFolder\\Sub', candidates).ancestors);

console.log("TEST 2: Absolute Path not in special");
console.log(calculateAncestors('D:\\Manga\\Naruto', candidates).ancestors);

console.log("TEST 3: Absolute Path matching special exactly");
console.log(calculateAncestors('C:\\Users\\megam\\Downloads', candidates).ancestors);

console.log("TEST 4: Inside Archive in special");
console.log(calculateAncestors('C:\\Users\\megam\\Downloads\\Test.zip!\\Inner', candidates).ancestors);
