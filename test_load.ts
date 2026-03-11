function testIsRootNode(resolvedPath: string, treeRoots: {path: string}[], favorites: {path: string}[]) {
  const sepIdx = Math.max(resolvedPath.lastIndexOf('/'), resolvedPath.lastIndexOf('\\'));
  if (sepIdx > 0) {
    // Current buggy logic
    const isRootNode = treeRoots.some(r => r.path === resolvedPath) ||
      favorites.some(f => f.path === resolvedPath);
    if (!isRootNode) {
      console.log('REVEAL PARENT:', resolvedPath.slice(0, sepIdx));
    } else {
      console.log('IS ROOT', resolvedPath);
    }
  }
}

const treeRoots = [{ path: 'C:\\Users\\megam\\Downloads' }];
testIsRootNode('C:\\Users\\megam\\Downloads\\TestFolder', treeRoots, []);
testIsRootNode('C:\\Users\\megam\\Downloads', treeRoots, []);
