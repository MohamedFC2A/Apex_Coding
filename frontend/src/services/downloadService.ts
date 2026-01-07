import axios from 'axios';
import { ProjectFile } from '@/types';

import { apiUrl } from '@/services/apiBase';

export const downloadService = {
  async downloadAsZip(files: ProjectFile[], projectName: string): Promise<void> {
    try {
      const response = await axios.post(
        apiUrl('/download/zip'),
        {
          files
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
