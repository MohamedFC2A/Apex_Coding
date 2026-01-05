import axios from 'axios';
import { ProjectFile, ExecutionResult, ProjectStack } from '@/types';

const API_BASE = '/api';

export const codeExecutionService = {
  async executeCode(
    projectId: string,
    files: ProjectFile[],
    stack: ProjectStack,
    entryPoint?: string
  ): Promise<ExecutionResult> {
    try {
      const response = await axios.post(`${API_BASE}/execute/run`, {
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
      await axios.post(`${API_BASE}/execute/stop`, { projectId });
    } catch (error) {
      console.error('Failed to stop execution:', error);
    }
  },
  
  async getPortAllocations(): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE}/execute/ports`);
      return response.data;
    } catch (error) {
      console.error('Failed to get port allocations:', error);
      return { allocations: [] };
    }
  }
};
