import React, { useCallback, useMemo, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { ChevronDown, ChevronRight, Database, FileText, Folder, Settings, User } from 'lucide-react';
import { useAIStore } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePreviewStore } from '@/stores/previewStore';
import { useLanguage } from '@/context/LanguageContext';
import { FileSystem } from '@/types';
import { getLanguageFromExtension } from '@/utils/stackDetector';
import { LanguageIconBadge } from '@/components/files/LanguageIconBadge';

type SidebarTab = 'files' | 'database';

type NodeStatus = 'ready' | 'queued' | 'writing';

type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
};

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const FadeInWrapper = styled.div`
  animation: ${fadeIn} 0.3s ease forwards;
`;

// --- Styled Components ---

const Shell = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
  backdrop-filter: blur(24px);
  box-shadow: 
    0 8px 32px 0 rgba(0, 0, 0, 0.36),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
  overflow: hidden;
  min-height: 0;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  
  &:hover {
    box-shadow: 
      0 12px 48px 0 rgba(0, 0, 0, 0.45),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.12);
  }
`;

const Header = styled.div`
  display: grid;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const HeaderTitle = styled.div`
  font-weight: 700;
  letter-spacing: 0.05em;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  gap: 8px;
  
  &::before {
    content: '';
    width: 6px;
    height: 6px;
    background: #3b82f6;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
  }
`;

const Tabs = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
`;

const TabButton = styled.button<{ $active?: boolean }>`
  height: 30px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: ${(p) => (p.$active ? 'rgba(255, 255, 255, 0.1)' : 'transparent')};
  color: ${(p) => (p.$active ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.5)')};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: ${(p) => (p.$active ? 'blur(8px)' : 'none')};
  box-shadow: ${(p) => (p.$active ? '0 2px 8px rgba(0,0,0,0.1)' : 'none')};

  &:hover {
    color: rgba(255, 255, 255, 0.9);
    background: ${(p) => (p.$active ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)')};
  }
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
  
  /* Noise Texture Overlay */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: var(--noise-pattern);
    opacity: 0.03;
    pointer-events: none;
    z-index: 0;
  }
`;

const TreeContainer = styled.div`
  height: 100%;
  padding: 12px;
  overflow-y: auto;
  position: relative;
  z-index: 1;
`;

const TreeRow = styled.button<{ $active?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid ${(p) => (p.$active ? 'rgba(59, 130, 246, 0.2)' : 'transparent')};
  background: ${(p) => (p.$active ? 'rgba(59, 130, 246, 0.1)' : 'transparent')};
  color: ${(p) => (p.$active ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.7)')};
  cursor: pointer;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: 2px;

  &:hover {
    background: ${(p) => (p.$active ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)')};
    color: rgba(255, 255, 255, 1);
    transform: translateX(2px);
  }
  
  & svg {
    opacity: ${(p) => (p.$active ? 1 : 0.7)};
    transition: opacity 0.2s;
  }
`;

const TreeLabel = styled.span`
  font-size: 13px;
  font-weight: 500;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', monospace; /* Monospace for files */
`;

const StatusGroup = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const StatusText = styled.span`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(250, 204, 21, 0.9);
  padding: 2px 4px;
  background: rgba(250, 204, 21, 0.1);
  border-radius: 4px;
`;

const StatusDot = styled.span<{ $color: string }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${(p) => p.$color};
  box-shadow: 0 0 6px ${(p) => p.$color};
`;

const EmptyState = styled.div`
  padding: 32px 16px;
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  
  svg {
    opacity: 0.3;
  }
`;

const SkeletonRow = styled.div`
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.03) 0%,
    rgba(255, 255, 255, 0.07) 50%,
    rgba(255, 255, 255, 0.03) 100%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 2s infinite linear;
`;

const SkeletonStack = styled.div`
  display: grid;
  gap: 8px;
  padding: 6px 4px;
`;

const Footer = styled.div`
  flex-shrink: 0;
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
`;

const FooterMeta = styled.div`
  display: grid;
  gap: 2px;
  min-width: 0;
`;

const FooterMetaLine = styled.div`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  
  &:last-child {
    font-size: 10px;
    opacity: 0.5;
    font-weight: 400;
  }
`;

const FooterButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
`;

// Helper functions (same as before)
const getStatusColor = (status: NodeStatus) => {
  if (status === 'writing') return 'rgba(250, 204, 21, 1)';
  if (status === 'queued') return 'rgba(59, 130, 246, 1)';
  return 'rgba(34, 197, 94, 1)';
};

const normalizeFileSystem = (files: FileSystem | []) => (Array.isArray(files) ? {} : files);

const treeHasAnyPathPrefix = (tree: FileSystem, prefix: string, basePath = ''): boolean => {
  for (const [name, entry] of Object.entries(tree)) {
    const path = basePath ? `${basePath}/${name}` : name;
    if (path.startsWith(prefix)) return true;
    if (entry.directory && treeHasAnyPathPrefix(entry.directory, prefix, path)) return true;
  }
  return false;
};

const treeHasPackageDependency = (tree: FileSystem, dependency: string): boolean => {
  const packageNode = tree['package.json']?.file?.contents;
  if (typeof packageNode === 'string' && packageNode.includes(`"${dependency}"`)) return true;
  return false;
};

const buildTreeNodes = (tree: FileSystem, basePath = ''): TreeNode[] => {
  const entries = Object.entries(tree).map(([name, entry]) => {
    const path = basePath ? `${basePath}/${name}` : name;
    if (entry.directory) {
      return {
        name,
        path,
        type: 'folder' as const,
        children: buildTreeNodes(entry.directory, path)
      };
    }
    return { name, path, type: 'file' as const };
  });

  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
};

interface FileTreeItemProps {
  node: TreeNode;
  depth: number;
  openNodes: Record<string, boolean>;
  onToggle: (path: string) => void;
  onSelectFile: (path: string) => void;
  activeFile: string | null;
  getStatus: (path: string) => NodeStatus;
  isRTL?: boolean;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  depth,
  openNodes,
  onToggle,
  onSelectFile,
  activeFile,
  getStatus,
  isRTL
}) => {
  const isFolder = node.type === 'folder';
  const isActive = node.type === 'file' && activeFile === node.path;
  const isOpen = isFolder ? openNodes[node.path] ?? depth === 0 : false;
  const status = node.type === 'file' ? getStatus(node.path) : 'ready';
  const statusColor = getStatusColor(status);

  const handleClick = () => {
    if (isFolder) {
      onToggle(node.path);
      return;
    }
    onSelectFile(node.path);
  };

  return (
    <FadeInWrapper>
      <TreeRow
        type="button"
        $active={isActive}
        onClick={handleClick}
        style={{
          paddingLeft: isRTL ? '10px' : `${depth * 16 + 10}px`,
          paddingRight: isRTL ? `${depth * 16 + 10}px` : '10px',
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}
        aria-expanded={isFolder ? isOpen : undefined}
      >
        {isFolder ? (
          <>
            {isOpen ? <ChevronDown size={14} className="text-nexus-muted" /> : <ChevronRight size={14} className="text-nexus-muted" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} />}
            <Folder size={16} className="text-blue-400" />
          </>
        ) : (
          <LanguageIconBadge language={getLanguageFromExtension(node.path || node.name || '')} size="md" />
        )}
        <TreeLabel style={{ textAlign: isRTL ? 'right' : 'left' }}>{node.name}</TreeLabel>
        {node.type === 'file' && (
          <StatusGroup style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            {status === 'writing' && <StatusText>Writing</StatusText>}
            <StatusDot $color={statusColor} />
          </StatusGroup>
        )}
      </TreeRow>
      {isFolder && isOpen && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              openNodes={openNodes}
              onToggle={onToggle}
              onSelectFile={onSelectFile}
              activeFile={activeFile}
              getStatus={getStatus}
              isRTL={isRTL}
            />
          ))}
        </div>
      )}
    </FadeInWrapper>
  );
};

export interface SidebarProps {
  className?: string;
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ className, onOpenSettings }) => {
  const { t, isRTL } = useLanguage();
  const [tab, setTab] = useState<SidebarTab>('files');
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});
  const { files, fileStatuses, writingFilePath } = useAIStore();
  const { activeFile, setActiveFile, files: flatFiles, isHydrating, stack } = useProjectStore();
  const { runtimeStatus } = usePreviewStore();

  const toggleNode = useCallback((path: string) => {
    setOpenNodes((prev) => ({
      ...prev,
      [path]: !prev[path]
    }));
  }, []);

  const getStatus = useCallback(
    (path: string): NodeStatus => {
      const status = fileStatuses[path] as NodeStatus | undefined;
      if (writingFilePath && writingFilePath === path) return 'writing';
      return status || 'ready';
    },
    [fileStatuses, writingFilePath]
  );

  const fsTree = useMemo(() => normalizeFileSystem(files), [files]);
  const tree = useMemo(() => buildTreeNodes(fsTree), [fsTree]);
  const convexEnabled = useMemo(() => {
    if (treeHasAnyPathPrefix(fsTree, 'convex/')) return true;
    if (treeHasAnyPathPrefix(fsTree, 'frontend/convex/')) return true;
    if (treeHasPackageDependency(fsTree, 'convex')) return true;

    const rootPkg = flatFiles.find((f) => (f.path || f.name) === 'package.json')?.content || '';
    if (rootPkg.includes('"convex"')) return true;
    return false;
  }, [flatFiles, fsTree]);

  const schemaSource = useMemo(() => {
    const schemaFile =
      flatFiles.find((f) => (f.path || f.name) === 'convex/schema.ts') ||
      flatFiles.find((f) => (f.path || f.name) === 'convex/schema.js') ||
      flatFiles.find((f) => (f.path || f.name) === 'convex/schema.tsx') ||
      null;
    return schemaFile?.content || '';
  }, [flatFiles]);

  const schemaTables = useMemo(() => {
    if (!schemaSource) return [];
    const names = new Set<string>();

    for (const line of schemaSource.split(/\r?\n/)) {
      const m = line.match(/^\s*([a-zA-Z0-9_]+)\s*:\s*defineTable\s*\(/);
      if (m?.[1]) names.add(m[1]);
    }

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [schemaSource]);

  const schemaPreview = useMemo(() => {
    if (!schemaSource) return '';
    const max = 2200;
    const text = schemaSource.length > max ? `${schemaSource.slice(0, max)}\n\n// [[TRUNCATED]]` : schemaSource;
    return text.trim();
  }, [schemaSource]);

  const renderTree = () => {
    if (isHydrating && tree.length === 0) {
      return (
        <SkeletonStack aria-label="Loading files">
          {Array.from({ length: 10 }).map((_, idx) => (
            <SkeletonRow key={idx} />
          ))}
        </SkeletonStack>
      );
    }

    if (tree.length === 0) {
      return (
        <EmptyState>
          <Folder size={40} />
          <div>No files yet. Generate code to get started.</div>
        </EmptyState>
      );
    }

    return tree.map((node) => (
      <FileTreeItem
        key={node.path}
        node={node}
        depth={0}
        openNodes={openNodes}
        onToggle={toggleNode}
        onSelectFile={setActiveFile}
        activeFile={activeFile}
        getStatus={getStatus}
        isRTL={isRTL}
      />
    ));
  };

  return (
    <Shell className={className}>
      <Header>
        <HeaderRow style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <HeaderTitle>{t('app.sidebar.files')}</HeaderTitle>
        </HeaderRow>
        <Tabs style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
          <TabButton
            type="button"
            $active={tab === 'files'}
            onClick={() => setTab('files')}
            aria-label="Files"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            <FileText size={14} />
            {t('app.sidebar.files')}
          </TabButton>
          <TabButton
            type="button"
            $active={tab === 'database'}
            onClick={() => setTab('database')}
            aria-label="Database"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            <Database size={14} />
            {t('app.sidebar.history')}
          </TabButton>
        </Tabs>
      </Header>
      <Body>
        {tab === 'files' ? (
          <TreeContainer className="scrollbar-thin scrollbar-glass" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>{renderTree()}</TreeContainer>
        ) : (
          <TreeContainer className="scrollbar-thin scrollbar-glass">
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Database size={18} className="text-purple-400" />
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
                  Database
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                {convexEnabled ? 'Convex detected. Schema + data live in your project.' : 'No Database Required.'}
              </div>

              {convexEnabled && (
                <div
                  style={{
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    backdropFilter: 'blur(10px)',
                    padding: 16,
                    display: 'grid',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
                      Schema
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                      {schemaTables.length > 0 ? `Tables: ${schemaTables.join(', ')}` : 'Tables: —'}
                    </div>
                  </div>
                  {schemaPreview ? (
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: 'rgba(255,255,255,0.7)',
                        fontFamily: 'JetBrains Mono, monospace'
                      }}
                    >
                      {schemaPreview}
                    </pre>
                  ) : (
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                      No `convex/schema.ts` found yet. Ask the AI to create it.
                    </div>
                  )}
                </div>
              )}
            </div>
          </TreeContainer>
        )}
      </Body>
      <Footer style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <FooterMeta style={{ textAlign: isRTL ? 'right' : 'left' }}>
          <FooterMetaLine>{t('brand.name')}</FooterMetaLine>
          <FooterMetaLine>v1.0.4-alpha</FooterMetaLine>
        </FooterMeta>
        <FooterButton type="button" aria-label="Settings" title="Settings" onClick={onOpenSettings}>
          <User size={18} />
        </FooterButton>
      </Footer>
    </Shell>
  );
};
