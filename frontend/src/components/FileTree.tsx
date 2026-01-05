import React from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useAIStore } from '@/stores/aiStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  File,
  Folder,
  ChevronRight,
  ChevronDown,
  FileCode2,
  FileJson,
  FileText,
  Palette,
  PenLine,
  Dot
} from 'lucide-react';
import { FileStructure } from '@/types';

interface FileTreeNodeProps {
  node: FileStructure;
  depth: number;
}

type NodeStatus = 'ready' | 'queued' | 'writing';

const getFileIcon = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  if (!ext) return File;
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'cs', 'php'].includes(ext)) return FileCode2;
  if (['css', 'scss', 'sass', 'less'].includes(ext)) return Palette;
  if (['json', 'jsonc'].includes(ext)) return FileJson;
  if (['md', 'txt', 'env', 'yml', 'yaml'].includes(ext)) return FileText;
  if (['html', 'htm'].includes(ext)) return FileCode2;
  return File;
};

const getStatusColor = (status: NodeStatus) => {
  if (status === 'writing') return 'rgba(250, 204, 21, 0.95)';
  if (status === 'queued') return 'rgba(59, 130, 246, 0.95)';
  return 'rgba(34, 197, 94, 0.95)';
};

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, depth }) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const { activeFile, setActiveFile } = useProjectStore();
  const { fileStatuses, writingFilePath } = useAIStore();

  const computeStatus = React.useCallback(
    (n: FileStructure): NodeStatus => {
      if (n.type === 'file') {
        const status = fileStatuses[n.path] as NodeStatus | undefined;
        if (writingFilePath && writingFilePath === n.path) return 'writing';
        return status || 'ready';
      }

      const children = n.children || [];
      let hasQueued = false;
      for (const child of children) {
        const s = computeStatus(child);
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
  const FileIcon = node.type === 'file' ? getFileIcon(node.path) : Folder;

  return (
    <div>
      <motion.div
        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md transition-colors ${
          isActive
            ? 'bg-[#1f2428] text-white ring-1 ring-cyan-500/20 shadow-[0_0_18px_rgba(34,211,238,0.10)]'
            : 'hover:bg-[#161b22] text-white/80'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        layout
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
      >
        {node.type === 'directory' ? (
          <>
            {isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <FileIcon className="w-4 h-4 text-white/60" />
          </>
        ) : (
          <>
            <FileIcon className="w-4 h-4 text-gray-300 ml-4" />
          </>
        )}
        <span className="text-sm truncate">{node.path.split('/').pop()}</span>
        {node.type === 'file' && (
          <span className="ml-auto flex items-center gap-1.5 pr-1">
            <AnimatePresence>
              {status === 'writing' && (
                <motion.span
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  className="text-[10px] font-semibold tracking-wide text-yellow-200/90"
                >
                  Writing…
                </motion.span>
              )}
            </AnimatePresence>
            <StatusIcon
              className={status === 'writing' ? 'w-4 h-4 animate-pulse' : 'w-4 h-4'}
              style={{ color: statusColor }}
            />
          </span>
        )}
      </motion.div>
      
      {node.type === 'directory' && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileTree: React.FC = () => {
  const { files, fileStructure } = useProjectStore();

  if (files.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No files yet. Generate code to get started.
      </div>
    );
  }

  // Build tree structure if not provided
  const tree = fileStructure.length > 0 
    ? fileStructure 
    : files.filter(f => f.path).map(f => ({ path: f.path!, type: 'file' as const }));

  return (
    <div className="p-2 scrollbar-thin overflow-y-auto">
      {tree.map((node) => (
        <FileTreeNode key={node.path} node={node} depth={0} />
      ))}
    </div>
  );
};
