import React from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useAIStore } from '@/stores/aiStore';
import { useLanguage } from '@/context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  File,
  Folder,
  ChevronRight,
  ChevronDown,
  PenLine,
  Dot
} from 'lucide-react';
import { FileStructure } from '@/types';
import { getLanguageFromExtension } from '@/utils/stackDetector';
import { LanguageIconBadge } from '@/components/files/LanguageIconBadge';

interface FileTreeNodeProps {
  node: FileStructure;
  depth: number;
  isRTL?: boolean;
}

type NodeStatus = 'ready' | 'queued' | 'writing';

const getStatusColor = (status: NodeStatus) => {
  if (status === 'writing') return 'rgba(245, 158, 11, 0.95)';
  if (status === 'queued') return 'rgba(59, 130, 246, 0.95)';
  return 'rgba(34, 197, 94, 0.95)';
};

const normalizePath = (value: string) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();

const buildTreeFromFlatStructure = (entries: Array<{ path: string; type: 'file' | 'directory' }>): FileStructure[] => {
  const nodeMap = new Map<string, FileStructure>();

  const ensureDirectoryNode = (path: string) => {
    const normalized = normalizePath(path);
    if (!normalized) return null;
    const existing = nodeMap.get(normalized);
    if (existing) {
      if (!existing.children) existing.children = [];
      return existing;
    }
    const parts = normalized.split('/');
    const name = parts[parts.length - 1] || normalized;
    const created: FileStructure = {
      name,
      path: normalized,
      type: 'directory',
      children: []
    };
    nodeMap.set(normalized, created);
    return created;
  };

  const ensureNode = (path: string, type: 'file' | 'directory') => {
    const normalized = normalizePath(path);
    if (!normalized) return null;

    const parts = normalized.split('/').filter(Boolean);
    let parentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      parentPath = parentPath ? `${parentPath}/${parts[i]}` : parts[i];
      ensureDirectoryNode(parentPath);
    }

    const existing = nodeMap.get(normalized);
    if (existing) {
      if (type === 'directory' && !existing.children) existing.children = [];
      return existing;
    }

    const name = parts[parts.length - 1] || normalized;
    const node: FileStructure =
      type === 'directory'
        ? { name, path: normalized, type: 'directory', children: [] }
        : { name, path: normalized, type: 'file' };
    nodeMap.set(normalized, node);
    return node;
  };

  for (const entry of entries) {
    ensureNode(entry.path, entry.type);
  }

  const roots: FileStructure[] = [];
  const sortedNodes = Array.from(nodeMap.values()).sort((a, b) => {
    const depthA = normalizePath(a.path).split('/').length;
    const depthB = normalizePath(b.path).split('/').length;
    if (depthA !== depthB) return depthA - depthB;
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  for (const node of sortedNodes) {
    const normalizedPath = normalizePath(node.path);
    const parentPath = normalizedPath.includes('/')
      ? normalizedPath.slice(0, normalizedPath.lastIndexOf('/'))
      : '';
    if (!parentPath) {
      roots.push(node);
      continue;
    }
    const parent = nodeMap.get(parentPath);
    if (!parent || parent.type !== 'directory') {
      roots.push(node);
      continue;
    }
    if (!parent.children) parent.children = [];
    if (!parent.children.some((child) => child.path === node.path)) {
      parent.children.push(node);
      parent.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
      });
    }
  }

  return roots.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '');
  });
};

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, depth, isRTL }) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const { activeFile, setActiveFile } = useProjectStore();
  const { fileStatuses, writingFilePath } = useAIStore();

  const computeStatus = React.useCallback(
    function computeStatusInner(n: FileStructure): NodeStatus {
      if (n.type === 'file') {
        const status = fileStatuses[n.path] as NodeStatus | undefined;
        if (writingFilePath && writingFilePath === n.path) return 'writing';
        return status || 'ready';
      }

      const children = n.children || [];
      let hasQueued = false;
      for (const child of children) {
        const s = computeStatusInner(child);
        if (s === 'writing') return 'writing';
        if (s === 'queued') hasQueued = true;
      }
      return hasQueued ? 'queued' : 'ready';
    },
    [fileStatuses, writingFilePath]
  );

  const handleClick = () => {
    if (node.type === 'file') {
      setActiveFile(node.path);
    } else {
      setIsOpen(!isOpen);
    }
  };

  const isActive = activeFile === node.path;
  const status = computeStatus(node);
  const StatusIcon = status === 'writing' ? PenLine : Dot;
  const statusColor = getStatusColor(status);
  return (
    <div>
      <motion.div
        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md transition-all duration-200 ${
          isActive
            ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/5'
            : 'hover:bg-white/5 text-white/70 hover:text-white'
        }`}
        style={{ 
          paddingLeft: isRTL ? '8px' : `${depth * 12 + 8}px`,
          paddingRight: isRTL ? `${depth * 12 + 8}px` : '8px',
          flexDirection: isRTL ? 'row-reverse' : 'row'
        }}
        onClick={handleClick}
        layout
        initial={{ opacity: 0, x: isRTL ? 6 : -6 }}
        animate={{ opacity: 1, x: 0 }}
      >
        {node.type === 'directory' ? (
          <>
            {isOpen ? (
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            ) : (
              <ChevronRight className={`w-3.5 h-3.5 opacity-70 ${isRTL ? 'rotate-180' : ''}`} />
            )}
            <Folder className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-blue-400/80'}`} />
          </>
        ) : (
          <>
            <div className="w-3.5" />
            {node.path ? (
              <LanguageIconBadge size="sm" language={getLanguageFromExtension(node.path)} />
            ) : (
              <File className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-white/40'}`} />
            )}
          </>
        )}
        <span className={`text-xs font-medium truncate ${isRTL ? 'text-right' : 'text-left'} flex-1 font-mono tracking-tight`}>
          {node.name || node.path.split('/').pop()}
        </span>
        {status !== 'ready' && (
          <StatusIcon className="w-3 h-3 animate-pulse" style={{ color: statusColor }} />
        )}
      </motion.div>

      <AnimatePresence>
        {node.type === 'directory' && isOpen && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <FileTreeNode key={child.path} node={child} depth={depth + 1} isRTL={isRTL} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const FileTree: React.FC = () => {
  const { files, fileStructure, fileSystem } = useProjectStore();
  const { isRTL } = useLanguage();

  if (fileSystem && Object.keys(fileSystem).length > 0) {
    const buildTree = (fs: any, path = ''): FileStructure[] => {
      return Object.entries(fs).map(([name, entry]: [string, any]) => {
        const currentPath = path ? `${path}/${name}` : name;
        if (entry.directory) {
          return {
            name,
            path: currentPath,
            type: 'directory' as const,
            children: buildTree(entry.directory, currentPath)
          };
        }
        return {
          name,
          path: currentPath,
          type: 'file' as const
        };
      }).sort((a, b) => {
        if (a.type === b.type) return (a.name || '').localeCompare(b.name || '');
        return a.type === 'directory' ? -1 : 1;
      });
    };

    const tree = buildTree(fileSystem);

    return (
      <div className="py-2" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
        {tree.map((node) => (
          <FileTreeNode key={node.path} node={node} depth={0} isRTL={isRTL} />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="p-4 text-white/30 text-xs text-center italic">
        No files yet. Generate code to get started.
      </div>
    );
  }

  const flatEntries: Array<{ path: string; type: 'file' | 'directory' }> =
    fileStructure.length > 0
      ? fileStructure.map((entry) => ({
          path: normalizePath(entry.path),
          type: entry.type === 'directory' ? 'directory' : 'file'
        }))
      : files
          .filter((f) => f.path)
          .map((f) => ({ path: normalizePath(f.path || ''), type: 'file' as const }));
  const tree = buildTreeFromFlatStructure(flatEntries.filter((entry) => entry.path.length > 0));

  return (
    <div className="p-2 scrollbar-thin overflow-y-auto" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      {tree.map((node) => (
        <FileTreeNode key={node.path} node={node} depth={0} isRTL={isRTL} />
      ))}
    </div>
  );
};
