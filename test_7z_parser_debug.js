
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
  const pairRegex = new RegExp(`(${keysPattern})\\s*=\\s*([\\s\\S]*?)(?=\\s+(?:${keysPattern})\\s*=|$)`, 'g');
  
  let currentEntry = {};
  let match;

  while ((match = pairRegex.exec(stdout)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    
    if (key === 'Path' && Object.keys(currentEntry).length > 0) {
      pushProcessedEntry(entries, currentEntry);
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
  entries.push({ path, size, isDir });
}

const input = `Attributes = Encrypted = - Comment = CRC = DC01258A Method = Deflate Characteristics = Local Host OS = Version = 10 Volume Index = 0 Offset = 21717112 Path = 3708825_f2c2443ed4\\078001Omake_046.webp Folder = - Size = 78280 Packed Size = 78305 Modified = 2026-03-02 23:42:00 Created = Accessed = Attributes = Encrypted = - Comment = CRC = 5F59E4FD Method = Deflate Characteristics = Local Host OS = Version = 10 Volume Index = 0 Offset = 21798268 Path = 3708825_f2c2443ed4\\079001Omake_047.webp Folder = - Size = 82210 Packed Size = 82240 Modified = 2026-03-02 23:42:00 Created = Accessed = Attributes = Encrypted = - Comment = CRC = 59CF321A Method = Deflate Characteristics = Local Host OS = Version = 10 Volume Index = 0 Offset = 21876642 Path = 3708825_f2c2443ed4\\080001Omake_048.webp Folder = - Size = 86102 Packed Size = 86132 Modified = 2026-03-02 23:42:00 Created = Accessed = Attributes = Encrypted = - Comment = CRC = 942B9BED Method = Deflate Characteristics = Local Host OS = Version = 10 Volume Index = 0 Offset = 21958951 Path = 3708825_f2c2443ed4\\081001Omake_049.webp Folder = - Size = 88692 Packed Size = 88722 Modified =`;

console.log('Result:', JSON.stringify(parse7zListOutput(input), null, 2));
