import { ChildProcess } from 'child_process';

interface PortAllocation {
  port: number;
  projectId: string;
  process?: ChildProcess;
  type: 'vite' | 'node' | 'python';
}

class PortManager {
  private allocations: Map<number, PortAllocation> = new Map();
  private readonly PORT_RANGE_START = 3000;
  private readonly PORT_RANGE_END = 3999;
  private readonly VITE_PORT_START = 5173;
  private readonly VITE_PORT_END = 5272;

  allocatePort(projectId: string, type: 'vite' | 'node' | 'python'): number {
    const range = type === 'vite' 
      ? { start: this.VITE_PORT_START, end: this.VITE_PORT_END }
      : { start: this.PORT_RANGE_START, end: this.PORT_RANGE_END };

    for (let port = range.start; port <= range.end; port++) {
      if (!this.allocations.has(port)) {
        this.allocations.set(port, { port, projectId, type });
        return port;
      }
    }
    throw new Error('No available ports');
  }

  registerProcess(port: number, process: ChildProcess): void {
    const allocation = this.allocations.get(port);
    if (allocation) {
      allocation.process = process;
    }
  }

  releasePort(port: number): void {
    const allocation = this.allocations.get(port);
    if (allocation?.process) {
      try {
        allocation.process.kill();
      } catch (error) {
        console.error(`Failed to kill process on port ${port}:`, error);
      }
    }
    this.allocations.delete(port);
  }

  releaseProjectPorts(projectId: string): void {
    for (const [port, allocation] of this.allocations.entries()) {
      if (allocation.projectId === projectId) {
        this.releasePort(port);
      }
    }
  }

  getAllocations(): PortAllocation[] {
    return Array.from(this.allocations.values());
  }
}

export const portManager = new PortManager();
