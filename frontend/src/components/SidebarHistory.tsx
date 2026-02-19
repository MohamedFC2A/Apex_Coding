import React, { useMemo } from 'react';
import styled from 'styled-components';
import { History, FolderOpen, Clock, FileCode2 } from 'lucide-react';
import { useAIStore, selectContextBudget } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';
import { FileSystem, ProjectFile } from '@/types';
import { getLanguageFromExtension } from '@/utils/stackDetector';
import { ContextPreview } from '@/components/ContextPreview';

const Wrapper = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  /* Do NOT set overflow:hidden here — OverlayBody is the scroll container */
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
  flex-shrink: 0;
`;

const ActionButton = styled.button`
  flex: 1;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(34, 211, 238, 0.20);
  background: rgba(34, 211, 238, 0.07);
  color: rgba(255, 255, 255, 0.85);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  white-space: nowrap;
  transition: background 160ms ease, border-color 160ms ease, transform 140ms ease, box-shadow 140ms ease;
  cursor: pointer;

  & svg {
    flex-shrink: 0;
    color: rgba(34, 211, 238, 0.85);
  }

  &:hover {
    border-color: rgba(34, 211, 238, 0.45);
    background: rgba(34, 211, 238, 0.14);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(34, 211, 238, 0.12);
  }
`;

const SectionLabel = styled.div`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.38);
  padding: 0 2px;
  flex-shrink: 0;
`;

const SessionList = styled.div`
  display: grid;
  gap: 7px;
  /* No overflow here — parent OverlayBody scrolls */
`;

const SessionCard = styled.button`
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  text-align: left;
  transition: background 160ms ease, border-color 160ms ease, transform 140ms ease, box-shadow 140ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.065);
    border-color: rgba(34, 211, 238, 0.20);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.24);
  }
`;

const SessionIconWrap = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 1px;
`;

const SessionCardBody = styled.div`
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 5px;
`;

const SessionMain = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
`;

const SessionTitle = styled.div`
  font-size: 12.5px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.90);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
`;

const SessionMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.42);
  font-size: 10.5px;
  font-weight: 500;
`;

const SessionMetaChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;

  & svg {
    opacity: 0.6;
  }
`;

const ContextMeter = styled.div`
  height: 3px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  margin-top: 2px;
`;

const ContextFill = styled.div<{ $pct: number; $status: 'ok' | 'warning' | 'critical' }>`
  height: 100%;
  width: ${(p) => Math.min(100, Math.max(0, p.$pct))}%;
  background: ${(p) =>
    p.$status === 'critical'
      ? 'rgba(239, 68, 68, 0.9)'
      : p.$status === 'warning'
        ? 'rgba(251, 191, 36, 0.9)'
        : 'rgba(34, 211, 238, 0.85)'};
  transition: width 200ms ease;
  border-radius: inherit;
`;

const RestoreTag = styled.div`
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(34, 211, 238, 0.65);
  flex-shrink: 0;
  padding-top: 2px;
`;

const EmptyState = styled.div`
  padding: 24px 16px;
  border-radius: 14px;
  border: 1px dashed rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.38);
  font-size: 12px;
  text-align: center;
  line-height: 1.6;
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

  const sortedHistory = useMemo(
    () =>
      [...history].sort((a, b) =>
        (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)
      ),
    [history]
  );

  const handleRestore = (sessionId: string) => {
    const session = sortedHistory.find((item) => item.id === sessionId);
    if (!session) return;

    restoreSession(sessionId);

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
          <History size={13} />
          New Chat
        </ActionButton>
      </ActionRow>

      <ContextPreview />

      {sortedHistory.length > 0 && (
        <SectionLabel>Saved Sessions — {sortedHistory.length}</SectionLabel>
      )}

      <SessionList>
        {sortedHistory.length === 0 ? (
          <EmptyState>
            No saved sessions yet.
            <br />
            Start a project and it will appear here.
          </EmptyState>
        ) : (
          sortedHistory.map((session) => {
            const displayName = session.projectName || session.title || 'Untitled Session';
            const fileCount = flattenFileSystem(session.files).length;
            const budget = session.contextBudget || selectContextBudget(session.id);
            return (
              <SessionCard key={session.id} type="button" onClick={() => handleRestore(session.id)}>
                <SessionIconWrap>
                  <FolderOpen size={13} />
                </SessionIconWrap>
                <SessionCardBody>
                  <SessionMain>
                    <SessionTitle>{displayName}</SessionTitle>
                  </SessionMain>
                  <SessionMetaRow>
                    <SessionMetaChip>
                      <Clock size={10} />
                      {formatDayMonth(session.updatedAt || session.createdAt)}
                    </SessionMetaChip>
                    {fileCount > 0 && (
                      <SessionMetaChip>
                        <FileCode2 size={10} />
                        {fileCount} file{fileCount !== 1 ? 's' : ''}
                      </SessionMetaChip>
                    )}
                    <SessionMetaChip style={{ marginLeft: 'auto', color: budget.status === 'critical' ? 'rgba(239,68,68,0.8)' : budget.status === 'warning' ? 'rgba(251,191,36,0.8)' : 'rgba(34,211,238,0.65)' }}>
                      ctx {budget.utilizationPct.toFixed(0)}%
                    </SessionMetaChip>
                  </SessionMetaRow>
                  <ContextMeter>
                    <ContextFill $pct={budget.utilizationPct} $status={budget.status} />
                  </ContextMeter>
                </SessionCardBody>
                <RestoreTag>Load</RestoreTag>
              </SessionCard>
            );
          })
        )}
      </SessionList>
    </Wrapper>
  );
};
