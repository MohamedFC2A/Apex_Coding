import axios from 'axios';
import { ProjectFile, ExecutionResult, ProjectStack } from '@/types';
import { API_BASE_URL } from '@/config';

const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

export const codeExecutionService = {
  async executeCode(
    projectId: string,
    files: ProjectFile[],
    stack: ProjectStack,
    entryPoint?: string
  ): Promise<ExecutionResult> {
    try {
      const response = await axios.post(apiUrl('/api/execute/run'), {
        projectId,
        files,
        stack,
        entryPoint
      });
      
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Execution failed',
        output: ''
      };
    }
  },
  
  async stopExecution(projectId: string): Promise<void> {
    try {
      await axios.post(apiUrl('/api/execute/stop'), { projectId });
    } catch (error) {
      console.error('Failed to stop execution:', error);
    }
  },
  
  async getPortAllocations(): Promise<any> {
    try {
      const response = await axios.get(apiUrl('/api/execute/ports'));
      return response.data;
    } catch (error) {
      console.error('Failed to get port allocations:', error);
      return { allocations: [] };
    }
  }
};
