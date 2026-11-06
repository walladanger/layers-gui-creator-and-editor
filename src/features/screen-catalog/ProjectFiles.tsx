import { useMemo } from 'react';
import { File, Folder, ExternalLink } from 'lucide-react';
import type { ScreenEntry } from '../../services/projectSource';

interface FileNode { name: string; path: string; children: Map<string, FileNode>; file: boolean }

function buildFolders(paths: string[]) {
  const root = new Map<string, FileNode>();
  for (const path of paths) {
    const parts = path.split('/').filter(Boolean);
    let children = root;
    parts.forEach((name, index) => {
      let node = children.get(name);
      if (!node) {
        node = { name, path: parts.slice(0, index + 1).join('/'), children: new Map(), file: index === parts.length - 1 };
        children.set(name, node);
      }
      children = node.children;
    });
  }
  return root;
}

export function ProjectFiles({ paths, screens, query, onOpen }: {
  paths: string[]; screens: ScreenEntry[]; query: string; onOpen: (screen: ScreenEntry) => void;
}) {
  const byPath = useMemo(() => {
    const map = new Map<string, ScreenEntry[]>();
    for (const screen of screens) map.set(screen.filePath, [...(map.get(screen.filePath) ?? []), screen]);
    return map;
  }, [screens]);
  const filter = query.trim().toLowerCase();
  const folders = useMemo(() => buildFolders(paths.filter(path => !filter ||
    path.toLowerCase().includes(filter) || byPath.get(path)?.some(screen => screen.name.toLowerCase().includes(filter)))),
  [paths, filter, byPath]);

  function renderNodes(nodes: Map<string, FileNode>, depth = 0) {
    return [...nodes.values()].sort((a, b) => Number(a.file) - Number(b.file) || a.name.localeCompare(b.name)).map(node => (
      <li key={node.path}>
        {node.file ? (
          <div className="project-files__file" title={node.path}>
            <File size={14} aria-hidden="true" /><span className="project-files__name">{node.name}</span>
            {byPath.get(node.path)?.map(screen => (
              <button key={screen.id} type="button" onClick={() => onOpen(screen)} aria-label={`Open ${screen.name} from ${node.path}`}>
                <ExternalLink size={12} aria-hidden="true" /> Open {screen.name}
              </button>
            ))}
          </div>
        ) : (
          <details open={!!filter || depth === 0}>
            <summary title={node.path}><Folder size={14} aria-hidden="true" /> {node.name}</summary>
            <ul>{renderNodes(node.children, depth + 1)}</ul>
          </details>
        )}
      </li>
    ));
  }

  return <nav className="project-files" aria-label="Project files">
    <p className="screen-catalog__note">Expand folders to browse files. Detected screens have an Open button.</p>
    {folders.size ? <ul key={filter}>{renderNodes(folders)}</ul> :
      <p className="screen-catalog__note">{filter ? 'No files match your filter.' : 'No project files found.'}</p>}
  </nav>;
}
