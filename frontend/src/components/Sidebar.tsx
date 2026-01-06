import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight, FileText, Files, Folder, History, ListTodo } from 'lucide-react';
import { PlanChecklist } from './ui/PlanChecklist';
import { SidebarHistory } from './SidebarHistory';
import { useAIStore } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';
import { FileSystem } from '@/types';

type SidebarTab = 'files' | 'plan' | 'history';

type NodeStatus = 'ready' | 'queued' | 'writing';

type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
};

const Shell = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(18px);
  box-shadow:
    0 22px 60px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
  overflow: hidden;
  min-height: 0;
`;

const Header = styled.div`
  display: grid;
  gap: 10px;
  padding: 12px 10px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(13, 17, 23, 0.35);
`;

const HeaderTitle = styled.div`
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.84);
`;

const Tabs = styled.div`
  display: grid;
  gap: 8px;
`;

const TabButton = styled.button<{ $active?: boolean }>`
  height: 32px;
  width: 100%;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.28)' : 'rgba(255, 255, 255, 0.10)')};
  background: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.10)' : 'rgba(255, 255, 255, 0.03)')};
  color: ${(p) => (p.$active ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.70)')};
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;

  & svg {
    flex-shrink: 0;
  }

  &:hover {
    border-color: rgba(168, 85, 247, 0.22);
    background: rgba(255, 255, 255, 0.05);
    transform: translateY(-1px);
  }
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const TreeContainer = styled.div`
  height: 100%;
  padding: 12px 10px;
  overflow-y: auto;
`;

const TreeRow = styled.button<{ $active?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 0;
  background: ${(p) => (p.$active ? 'rgba(255, 255, 255, 0.08)' : 'transparent')};
  color: ${(p) => (p.$active ? 'rgba(255, 255, 255, 0.94)' : 'rgba(255, 255, 255, 0.76)')};
  cursor: pointer;
  text-align: left;

  &:hover {
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.9);
  }
`;

const TreeLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatusGroup = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const StatusText = styled.span`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(250, 204, 21, 0.85);
`;

const StatusDot = styled.span<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${(p) => p.$color};
`;

const EmptyState = styled.div`
  padding: 14px;
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  text-align: center;
`;

const getStatusColor = (status: NodeStatus) => {
  if (status === 'writing') return 'rgba(250, 204, 21, 0.95)';
  if (status === 'queued') return 'rgba(59, 130, 246, 0.95)';
  return 'rgba(34, 197, 94, 0.95)';
};

const normalizeFileSystem = (files: FileSystem | []) => (Array.isArray(files) ? {} : files);

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
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  depth,
  openNodes,
  onToggle,
  onSelectFile,
  activeFile,
  getStatus
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
    <div>
      <TreeRow
        type="button"
        $active={isActive}
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        aria-expanded={isFolder ? isOpen : undefined}
      >
        {isFolder ? (
          <>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Folder size={16} />
          </>
        ) : (
          <FileText size={16} />
        )}
        <TreeLabel>{node.name}</TreeLabel>
        {node.type === 'file' && (
          <StatusGroup>
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

export interface SidebarProps {
  className?: string;
  defaultTab?: SidebarTab;
}

export const Sidebar: React.FC<SidebarProps> = ({ className, defaultTab = 'files' }) => {
  const [tab, setTab] = useState<SidebarTab>(defaultTab);
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});
  const { planSteps, isGenerating, files, fileStatuses, writingFilePath, architectMode } = useAIStore();
  const { activeFile, setActiveFile } = useProjectStore();

  const currentStepId = useMemo(() => planSteps.find((s) => !s.completed)?.id, [planSteps]);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (!architectMode && tab === 'plan') setTab('files');
  }, [architectMode, tab]);

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

  const tree = useMemo(() => buildTreeNodes(normalizeFileSystem(files)), [files]);

  const renderTree = () => {
    if (tree.length === 0) {
      return <EmptyState>No files yet. Generate code to get started.</EmptyState>;
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
      />
    ));
  };

  return (
    <Shell className={className}>
      <Header>
        <HeaderTitle>PROJECT EXPLORER</HeaderTitle>
        <Tabs>
          <TabButton type="button" $active={tab === 'files'} onClick={() => setTab('files')}>
            <Files size={16} />
            Files
          </TabButton>
          {architectMode && (
            <TabButton type="button" $active={tab === 'plan'} onClick={() => setTab('plan')}>
              <ListTodo size={16} />
              Plan
            </TabButton>
          )}
          <TabButton type="button" $active={tab === 'history'} onClick={() => setTab('history')}>
            <History size={16} />
            History
          </TabButton>
        </Tabs>
      </Header>
      <Body>
        {tab === 'files' ? (
          <TreeContainer className="scrollbar-thin scrollbar-glass">{renderTree()}</TreeContainer>
        ) : tab === 'plan' && architectMode ? (
          <PlanChecklist
            items={planSteps}
            currentStepId={isGenerating ? currentStepId : undefined}
            embedded
          />
        ) : (
          <SidebarHistory />
        )}
      </Body>
    </Shell>
  );
};
