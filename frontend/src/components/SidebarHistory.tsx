import React from 'react';
import styled from 'styled-components';
import { History, Save } from 'lucide-react';
import { useAIStore } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';
import { FileSystem, ProjectFile } from '@/types';
import { getLanguageFromExtension } from '@/utils/stackDetector';

const Wrapper = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
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
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;

  &:hover {
    border-color: rgba(34, 211, 238, 0.24);
    background: rgba(255, 255, 255, 0.08);
  }
`;

const SessionList = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  gap: 10px;
  padding-right: 2px;
`;

const SessionCard = styled.div`
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  display: grid;
  gap: 6px;
`;

const SessionTitle = styled.div`
  font-size: 12px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.88);
`;

const SessionMeta = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.52);
`;

const SessionActions = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
`;

const RestoreButton = styled.button`
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(168, 85, 247, 0.28);
  background: rgba(168, 85, 247, 0.10);
  color: rgba(255, 255, 255, 0.86);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;

  &:hover {
    background: rgba(168, 85, 247, 0.18);
    border-color: rgba(168, 85, 247, 0.45);
  }
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

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

export const SidebarHistory: React.FC = () => {
  const { history, saveCurrentSession, startNewChat, restoreSession } = useAIStore();
  const { setFiles, setFileStructure, setActiveFile } = useProjectStore();

  const handleRestore = (sessionId: string) => {
    const session = history.find((item) => item.id === sessionId);
    if (!session) return;

    restoreSession(sessionId);

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
        <ActionButton type="button" onClick={saveCurrentSession}>
          <Save size={14} />
          Save
        </ActionButton>
        <ActionButton type="button" onClick={startNewChat}>
          <History size={14} />
          New Chat
        </ActionButton>
      </ActionRow>

      <SessionList className="scrollbar-thin">
        {history.length === 0 ? (
          <EmptyState>No saved sessions yet.</EmptyState>
        ) : (
          history.map((session) => {
            const fileCount = flattenFileSystem(session.files).length;
            return (
              <SessionCard key={session.id}>
                <SessionTitle>{session.title || 'Untitled Session'}</SessionTitle>
                <SessionMeta>{formatTimestamp(session.createdAt)}</SessionMeta>
                <SessionMeta>{fileCount} files</SessionMeta>
                <SessionActions>
                  <RestoreButton type="button" onClick={() => handleRestore(session.id)}>
                    Restore
                  </RestoreButton>
                </SessionActions>
              </SessionCard>
            );
          })
        )}
      </SessionList>
    </Wrapper>
  );
};
