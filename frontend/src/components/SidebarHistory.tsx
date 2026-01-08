import React, { useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { History, Trash2, FolderOpen } from 'lucide-react';
import { useAIStore, HistorySession } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';
import { FileSystem, ProjectFile } from '@/types';
import { getLanguageFromExtension } from '@/utils/stackDetector';

const Wrapper = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  overflow: hidden;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button`
  flex: 1;
  height: 32px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.78);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  white-space: nowrap;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
  cursor: pointer;

  & svg {
    flex-shrink: 0;
  }

  &:hover {
    border-color: rgba(34, 211, 238, 0.24);
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }
`;

const SessionList = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  gap: 8px;
  padding-right: 2px;
`;

const SessionCard = styled.button`
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.035);
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  text-align: left;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.14);
    transform: translateY(-1px);
  }
`;

const SessionMain = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
`;

const SessionTitle = styled.div`
  font-size: 12px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.88);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SessionMeta = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.52);
  white-space: nowrap;
`;

const RightMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  white-space: nowrap;
`;

const EmptyState = styled.div`
  padding: 14px;
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  text-align: center;
`;

const flattenFileSystem = (tree: FileSystem, basePath = ''): ProjectFile[] => {
  const files: ProjectFile[] = [];

  for (const [name, entry] of Object.entries(tree)) {
    const nextPath = basePath ? `${basePath}/${name}` : name;
    if (entry.directory) {
      files.push(...flattenFileSystem(entry.directory, nextPath));
    }
    if (entry.file) {
      files.push({
        name,
        path: nextPath,
        content: entry.file.contents,
        language: getLanguageFromExtension(nextPath)
      });
    }
  }

  return files;
};

const formatDayMonth = (timestamp: number) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '??/??';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

export const SidebarHistory: React.FC = () => {
  const { history, startNewChat, restoreSession } = useAIStore();
  const { setFiles, setFileStructure, setActiveFile, setProjectName } = useProjectStore();

  // Deduplicate sessions by projectName, keeping only the most recent
  const deduplicatedHistory = useMemo(() => {
    const seen = new Map<string, HistorySession>();
    for (const session of history) {
      const key = session.projectName || session.id;
      const existing = seen.get(key);
      if (!existing || (session.updatedAt || session.createdAt) > (existing.updatedAt || existing.createdAt)) {
        seen.set(key, session);
      }
    }
    return Array.from(seen.values()).sort((a, b) => 
      (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)
    );
  }, [history]);

  const handleCleanDuplicates = useCallback(() => {
    // Clean up duplicate sessions in storage
    const cleaned = deduplicatedHistory;
    useAIStore.setState({ history: cleaned });
  }, [deduplicatedHistory]);

  const handleRestore = (sessionId: string) => {
    const session = deduplicatedHistory.find((item) => item.id === sessionId);
    if (!session) return;

    restoreSession(sessionId);

    // Restore project name
    if (session.projectName) {
      setProjectName(session.projectName);
    }

    const projectFiles = flattenFileSystem(session.files);
    setFiles(projectFiles);
    setFileStructure(
      projectFiles.map((file) => ({
        path: file.path || file.name,
        type: 'file' as const
      }))
    );

    if (projectFiles.length > 0) {
      const firstPath = projectFiles[0].path || projectFiles[0].name;
      if (firstPath) setActiveFile(firstPath);
    }
  };

  return (
    <Wrapper>
      <ActionRow>
        <ActionButton type="button" onClick={startNewChat}>
          <History size={14} />
          New Chat
        </ActionButton>
        {history.length > 0 && (
          <ActionButton type="button" onClick={handleCleanDuplicates} title="Clean duplicate sessions">
            <Trash2 size={14} />
          </ActionButton>
        )}
      </ActionRow>

      <SessionList className="scrollbar-thin scrollbar-glass">
        {deduplicatedHistory.length === 0 ? (
          <EmptyState>No saved sessions yet.</EmptyState>
        ) : (
          deduplicatedHistory.map((session) => {
            const displayName = session.projectName || session.title || 'Untitled Session';
            const fileCount = Object.keys(flattenFileSystem(session.files)).length;
            return (
              <SessionCard key={session.id} type="button" onClick={() => handleRestore(session.id)}>
                <FolderOpen size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
                <SessionMain>
                  <SessionTitle>{displayName}</SessionTitle>
                  <SessionMeta>
                    {formatDayMonth(session.updatedAt || session.createdAt)}
                    {fileCount > 0 && ` • ${fileCount} files`}
                  </SessionMeta>
                </SessionMain>
                <RightMeta>Restore</RightMeta>
              </SessionCard>
            );
          })
        )}
      </SessionList>
    </Wrapper>
  );
};
