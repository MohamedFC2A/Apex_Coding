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
  isRTL?: boolean;
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
  if (status === 'writing') return 'rgba(245, 158, 11, 0.95)';
  if (status === 'queued') return 'rgba(59, 130, 246, 0.95)';
  return 'rgba(34, 197, 94, 0.95)';
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
  const FileIcon = node.type === 'file' ? getFileIcon(node.path) : Folder;

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
            <FileIcon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-white/40'}`} />
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

  const tree = fileStructure.length > 0 
    ? fileStructure 
    : files.filter(f => f.path).map(f => ({ path: f.path!, type: 'file' as const }));

  return (
    <div className="p-2 scrollbar-thin overflow-y-auto" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      {tree.map((node) => (
        <FileTreeNode key={node.path} node={node} depth={0} isRTL={isRTL} />
      ))}
    </div>
  );
};
