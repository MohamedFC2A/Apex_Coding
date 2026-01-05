import axios from 'axios';
import { ProjectFile } from '@/types';

const API_BASE = '/api';

export const downloadService = {
  async downloadAsZip(
    files: ProjectFile[],
    projectName: string,
    description: string,
    stack: string
  ): Promise<void> {
    try {
      const response = await axios.post(
        `${API_BASE}/download/zip`,
        {
          files,
          projectName,
          description,
          stack
        },
        {
          responseType: 'blob'
        }
      );
      
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectName || 'project'}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download ZIP:', error);
      throw new Error('Failed to download project');
    }
  }
};
