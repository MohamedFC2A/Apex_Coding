import React from 'react';
import { Download } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { downloadService } from '@/services/downloadService';

export const DownloadButton: React.FC = () => {
  const { files, projectName } = useProjectStore();
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownload = async () => {
    if (files.length === 0) return;

    setIsDownloading(true);
    try {
      await downloadService.downloadAsZip(files, projectName || 'apex-project');
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={files.length === 0 || isDownloading}
      className="glass-button px-4 py-2 rounded-lg flex items-center justify-center gap-2"
    >
      <Download className="w-5 h-5" />
      <span>{isDownloading ? 'Downloading...' : 'Download ZIP'}</span>
    </button>
  );
};
