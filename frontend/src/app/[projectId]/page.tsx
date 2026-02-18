import { notFound, redirect } from 'next/navigation';

interface LegacyProjectLinkPageProps {
  params: {
    projectId: string;
  };
}

const normalizeProjectId = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw;
  }
};

export default function LegacyProjectLinkPage({ params }: LegacyProjectLinkPageProps) {
  const projectId = normalizeProjectId(params?.projectId);

  if (!/^project-[a-z0-9-]+$/i.test(projectId)) {
    notFound();
  }

  redirect(`/live-preview/${encodeURIComponent(projectId)}`);
}

