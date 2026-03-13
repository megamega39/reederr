
function parse7zListOutput(stdout) {
  const entries = [];
  const keys = [
    'Path', 'Size', 'Packed Size', 'Modified', 'Created', 'Accessed', 
    'Attributes', 'Encrypted', 'Comment', 'CRC', 'Method', 'Block', 
    'Folder', 'Version', 'Volume Index', 'Offset', 'Characteristics', 
    'Local Host OS', 'CPU', 'Host OS', 'Type', 'Physical Size', 
    'Headers Size', 'Method', 'Cluster Size', 'Free Space', 'Total Size', 
    'Checksum', 'Virtual Size', 'Solid', 'Blocks', 'Streams', 'Files', 'Folders'
  ];
  
  const sortedKeys = [...keys].sort((a, b) => b.length - a.length);
  const keysPattern = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const processed = stdout.replace(new RegExp(`(\\s+)(?=(?:${keysPattern})\\s*=)`, 'g'), '\n');
  
  const lines = processed.split('\n');
  let currentEntry = {};

  for (const line of lines) {
    const colon = line.indexOf('=');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();

    // Use duplicate key as a delimiter for a new entry
    if (currentEntry[key] !== undefined) {
      if (currentEntry['Path']) pushProcessedEntry(entries, currentEntry);
      currentEntry = {};
    }
    currentEntry[key] = value;
  }
  
  if (Object.keys(currentEntry).length > 0) {
    pushProcessedEntry(entries, currentEntry);
  }

  return entries;
}

function pushProcessedEntry(entries, data) {
  const path = data['Path']?.replace(/\\/g, '/');
  if (!path) return;
  const isDir = data['Folder'] === '+' || path.endsWith('/');
  const size = parseInt(data['Size'], 10) || 0;
  entries.push({ path, size, isDir, crc: data['CRC'] });
}

const input = `Attributes = Encrypted = - Comment = CRC = DC01258A Method = Deflate Characteristics = Local Host OS = Version = 10 Volume Index = 0 Offset = 21717112 Path = 3708825_f2c2443ed4\\078001Omake_046.webp Folder = - Size = 78280 Packed Size = 78305 Modified = 2026-03-02 23:42:00 Created = Accessed = Attributes = Encrypted = - Comment = CRC = 5F59E4FD Method = Deflate Characteristics = Local Host OS = Version = 10 Volume Index = 0 Offset = 21798268 Path = 3708825_f2c2443ed4\\079001Omake_047.webp`;

const result = parse7zListOutput(input);
console.log('Result Length:', result.length);
console.log('File 046 CRC (should be DC01258A):', result[0].crc);
console.log('File 047 CRC (should be 5F59E4FD):', result[1].crc);
