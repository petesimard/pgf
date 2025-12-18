import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class DevServer {
  private serverProcess: ChildProcess | null = null;
  private clientProcess: ChildProcess | null = null;
  private startedServers: boolean = false;

  async start(): Promise<void> {
    // Check if servers are already running
    const backendRunning = await this.isServerRunning('http://localhost:3000');
    const clientRunning = await this.isServerRunning('http://localhost:5173');

    if (backendRunning && clientRunning) {
      console.log('Dev servers already running, using existing servers');
      this.startedServers = false;
      return;
    }

    if (backendRunning || clientRunning) {
      throw new Error(
        'Only one server is running. Please stop all servers or start both manually.'
      );
    }

    console.log('Starting dev servers...');
    this.startedServers = true;

    // Start backend server
    this.serverProcess = spawn('npm', ['run', 'dev:server'], {
      stdio: 'pipe',
      detached: false,
    });

    // Start Vite dev server
    this.clientProcess = spawn('npm', ['run', 'dev:client'], {
      stdio: 'pipe',
      detached: false,
    });

    // Wait for servers to be ready
    await this.waitForServer('http://localhost:3000', 30000);
    await this.waitForServer('http://localhost:5173', 30000);

    console.log('Dev servers started successfully');
  }

  async stop(): Promise<void> {
    // Only stop servers if we started them
    if (!this.startedServers) {
      console.log('Using existing dev servers, not stopping them');
      return;
    }

    console.log('Stopping dev servers...');

    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      this.serverProcess = null;
    }

    if (this.clientProcess) {
      this.clientProcess.kill('SIGTERM');
      this.clientProcess = null;
    }

    // Kill any remaining processes on the ports
    try {
      await execAsync('pkill -f "tsx watch server/index.ts" || true');
      await execAsync('pkill -f "vite" || true');
    } catch (e) {
      // Ignore errors - processes might already be dead
    }

    // Wait a bit for ports to be released
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Dev servers stopped');
  }

  private async isServerRunning(url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      return response.ok || response.status === 404;
    } catch (e) {
      return false;
    }
  }

  private async waitForServer(url: string, timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url);
        if (response.ok || response.status === 404) {
          return;
        }
      } catch (e) {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Server at ${url} did not start within ${timeout}ms`);
  }
}
