import axios from 'axios';
import { ProjectFile } from '@/types';

const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'https://apex-coding-backend.vercel.app').replace(/\/+$/, '');

const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

export const downloadService = {
  async downloadAsZip(files: ProjectFile[], projectName: string): Promise<void> {
    try {
      const response = await axios.post(
        apiUrl('/api/download/zip'),
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
