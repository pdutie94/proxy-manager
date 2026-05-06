import { Injectable } from '@nestjs/common';
import { Client, ConnectConfig } from 'ssh2';
import { Node } from '@proxy-manager/db';

export type NodeTestStage = 'ssh' | 'system' | 'agent' | 'capability';

export interface NodeConnectionTestResult {
  ok: boolean;
  stage: NodeTestStage;
  code:
    | 'OK'
    | 'SSH_UNREACHABLE'
    | 'AUTH_FAILED'
    | 'NODE_INVALID'
    | 'NODE_NOT_READY'
    | 'NODE_CAPABILITY_FAILED';
  message: string;
  details?: Record<string, any>;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

@Injectable()
export class SshService {
  // ========================
  // PUBLIC API
  // ========================

  async testNodeConnection(node: Node): Promise<NodeConnectionTestResult> {
    let conn: Client | null = null;

    try {
      // 1. SSH
      conn = await this.connectSSH(node);

      // 2. System
      const system = await this.testSystem(conn);
      if (!system.ok) return system;

      // 3. Agent
      const agent = await this.testAgent(conn);
      if (!agent.ok) return agent;

      // 4. Capability
      const cap = await this.testCapability(conn);
      if (!cap.ok) return cap;

      return {
        ok: true,
        stage: 'capability',
        code: 'OK',
        message: 'Node is ready',
        details: {
          ...system.details,
          ...agent.details,
          ...cap.details,
        },
      };
    } catch (err: any) {
      return this.mapSshError(err);
    } finally {
      conn?.end();
    }
  }

  async initializeNode(node: Node): Promise<{ success: boolean; message: string; details?: any }> {
    let conn: Client | null = null;
    
    try {
      // First test connection
      const connectionTest = await this.testNodeConnection(node);
      if (!connectionTest.ok) {
        return {
          success: false,
          message: `Connection failed: ${connectionTest.message}`,
          details: connectionTest
        };
      }

      // Connect for initialization
      conn = await this.connectSSH(node);

      // Check if user has root privileges
      const rootCheck = await this.execSSH(conn, 'id -u');
      const userId = parseInt(rootCheck.stdout) || 0;
      const isRoot = userId === 0;

      if (!isRoot) {
        return {
          success: false,
          message: 'Root privileges required for node initialization. Please use a user with sudo access.',
          details: { userId, isRoot }
        };
      }

      // Detect package manager
      const pmCheck = await this.execSSH(conn, 'command -v apt-get && echo "apt" || (command -v dnf && echo "dnf" || (command -v yum && echo "yum" || echo "unknown"))');
      const packageManager = pmCheck.stdout.trim().split('\n').pop()?.trim() || 'unknown';

      if (packageManager === 'unknown') {
        return {
          success: false,
          message: 'No supported package manager found (apt-get/dnf/yum)',
          details: { stdout: pmCheck.stdout, stderr: pmCheck.stderr }
        };
      }

      // Build package manager commands
      const pkgCommands = this.getPackageCommands(packageManager);

      const initSteps: { name: string; command: string; timeout?: number; critical?: boolean }[] = [
        {
          name: 'Update package lists',
          command: pkgCommands.update,
          timeout: 60000,
        },
        {
          name: 'Install build dependencies',
          command: pkgCommands.installBuildDeps,
          timeout: 120000,
        },
        {
          name: 'Clean previous 3proxy source',
          command: 'rm -rf /tmp/3proxy',
          critical: false,
        },
        {
          name: 'Clone 3proxy source',
          command: 'cd /tmp && git clone --depth 1 https://github.com/3proxy/3proxy.git',
          timeout: 30000,
        },
        {
          name: 'Get version info',
          command: 'cd /tmp/3proxy && git describe --tags --always 2>/dev/null || git rev-parse --short HEAD',
          critical: false,
        },
        {
          name: 'Compile 3proxy',
          command: 'cd /tmp/3proxy && make -f Makefile.Linux',
          timeout: 120000,
        },
        {
          name: 'Install 3proxy binary',
          command: 'cd /tmp/3proxy && cp bin/3proxy /usr/local/bin/3proxy && chmod +x /usr/local/bin/3proxy',
        },
        {
          name: 'Create system user',
          command: 'id -u 3proxy >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin -d /nonexistent 3proxy',
        },
        {
          name: 'Create directory structure',
          command: 'mkdir -p /etc/3proxy/conf.d /var/log/3proxy /var/run/3proxy /opt/3proxy',
        },
        {
          name: 'Create base 3proxy config',
          command: [
            'cat > /etc/3proxy/3proxy.cfg << \'CFGEOF\'',
            '# 3Proxy base configuration',
            'nserver 8.8.8.8',
            'nserver 8.8.4.4',
            'nscache 65536',
            'timeouts 1 5 30 60 180 1800 15 60',
            '',
            '# Logging',
            'log /var/log/3proxy/3proxy.log D',
            'logformat "- +_L%t.%. %N.%p %E %U %C:%c %R:%r %O %I %h %T"',
            '',
            '# PID file',
            'pidfile /var/run/3proxy/3proxy.pid',
            '',
            '# Include shard configs',
            'include "/etc/3proxy/conf.d/"',
            'CFGEOF',
          ].join('\n'),
        },
        {
          name: 'Set ownership and permissions',
          command: 'chown -R 3proxy:3proxy /etc/3proxy /var/log/3proxy /var/run/3proxy /opt/3proxy && chmod 755 /etc/3proxy/conf.d',
        },
        {
          name: 'Create systemd service',
          command: [
            'cat > /etc/systemd/system/3proxy.service << \'SVCEOF\'',
            '[Unit]',
            'Description=3Proxy Daemon',
            'After=network.target',
            '',
            '[Service]',
            'Type=simple',
            'User=root',
            'ExecStart=/usr/local/bin/3proxy /etc/3proxy/3proxy.cfg',
            'ExecReload=/bin/kill -USR1 $MAINPID',
            'Restart=always',
            'RestartSec=5',
            'LimitNOFILE=65536',
            '',
            '[Install]',
            'WantedBy=multi-user.target',
            'SVCEOF',
          ].join('\n'),
        },
        {
          name: 'Enable and start 3proxy service',
          command: 'systemctl daemon-reload && systemctl enable 3proxy && systemctl start 3proxy',
        },
        {
          name: 'Verify 3proxy is running',
          command: 'systemctl is-active 3proxy && echo "3proxy is running" || echo "3proxy failed to start"',
          critical: false,
        },
      ];

      // Add IPv6 setup if subnet is configured
      if (node.ipv6Subnet) {
        // Find the main network interface
        const ifaceCheck = await this.execSSH(conn, "ip -o link show | awk -F': ' '{print $2}' | grep -v lo | head -1");
        const iface = ifaceCheck.stdout.trim();

        if (iface) {
          initSteps.push(
            {
              name: 'Enable IPv6 forwarding',
              command: 'sysctl -w net.ipv6.conf.all.forwarding=1 && echo "net.ipv6.conf.all.forwarding=1" >> /etc/sysctl.conf',
            },
            {
              name: 'Enable IPv6 proxy NDP',
              command: `sysctl -w net.ipv6.conf.${iface}.proxy_ndp=1 && echo "net.ipv6.conf.${iface}.proxy_ndp=1" >> /etc/sysctl.conf`,
              critical: false,
            },
          );
        }
      }

      // Clean up source after install
      initSteps.push({
        name: 'Clean up build files',
        command: 'rm -rf /tmp/3proxy',
        critical: false,
      });

      const results: any[] = [];

      for (const step of initSteps) {
        const timeout = step.timeout || 15000;
        const isCritical = step.critical !== false; // default true

        try {
          const result = await this.execSSH(conn, step.command, timeout);
          
          const stepResult = {
            step: step.name,
            success: result.exitCode === 0,
            exitCode: result.exitCode,
            output: result.stdout.slice(0, 500), // Limit output size
            error: result.stderr.slice(0, 500),
          };
          
          results.push(stepResult);
          
          if (isCritical && result.exitCode !== 0) {
            return {
              success: false,
              message: `Step failed: ${step.name}`,
              details: {
                steps: results,
                failedStep: step.name,
                exitCode: result.exitCode,
                output: result.stdout,
                error: result.stderr,
                packageManager,
              }
            };
          }
        } catch (error: any) {
          const stepResult = {
            step: step.name,
            success: false,
            exitCode: -1,
            output: '',
            error: error.message,
          };
          
          results.push(stepResult);

          if (isCritical) {
            return {
              success: false,
              message: `SSH command failed: ${step.name} - ${error.message}`,
              details: {
                steps: results,
                failedStep: step.name,
                error: error.message,
                packageManager,
              }
            };
          }
        }
      }

      return {
        success: true,
        message: '3Proxy installed and configured successfully',
        details: {
          steps: results,
          packageManager,
          version: results.find(r => r.step === 'Get version info')?.output || 'Unknown',
        }
      };

    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to initialize node',
        details: { error: error.message }
      };
    } finally {
      if (conn) {
        conn.end();
      }
    }
  }

  private getPackageCommands(pm: string): { update: string; installBuildDeps: string } {
    switch (pm) {
      case 'apt':
        return {
          update: 'apt-get update -qq',
          installBuildDeps: 'DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git make gcc',
        };
      case 'dnf':
        return {
          update: 'dnf makecache --quiet',
          installBuildDeps: 'dnf install -y git make gcc',
        };
      case 'yum':
        return {
          update: 'yum makecache fast --quiet',
          installBuildDeps: 'yum install -y git make gcc',
        };
      default:
        return {
          update: 'echo "Unknown package manager"',
          installBuildDeps: 'echo "Unknown package manager"',
        };
    }
  }

  // ========================
  // SSH CORE
  // ========================

  private connectSSH(node: Node): Promise<Client> {
    return new Promise((resolve, reject) => {
      const conn = new Client();

      const config: ConnectConfig = {
        host: node.ipAddress,
        port: node.sshPort,
        username: node.sshUsername || undefined,
        readyTimeout: 5000,
      };

      if (node.sshPassword) {
        (config as any).password = node.sshPassword;
      } else if (node.sshPrivateKey) {
        (config as any).privateKey = node.sshPrivateKey;
        if (node.sshKeyPassphrase) {
          (config as any).passphrase = node.sshKeyPassphrase;
        }
      } else {
        return reject(new Error('NO_AUTH'));
      }

      const timeout = setTimeout(() => {
        conn.destroy();
        reject(new Error('TIMEOUT'));
      }, 5000);

      conn
        .on('ready', () => {
          clearTimeout(timeout);
          resolve(conn);
        })
        .on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        })
        .connect(config);
    });
  }

  private execSSH(conn: Client, cmd: string, timeoutMs = 5000): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      let finished = false;

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          conn.end();
          reject(new Error(`CMD_TIMEOUT: ${cmd}`));
        }
      }, timeoutMs);

      conn.exec(cmd, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          return reject(err);
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (d: Buffer) => (stdout += d.toString()));
        stream.stderr.on('data', (d: Buffer) => (stderr += d.toString()));

        stream.on('close', (code: number) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);

          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code ?? 0,
          });
        });
      });
    });
  }

  private async retry<T>(fn: () => Promise<T>, times = 2): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < times; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  // ========================
  // TESTS
  // ========================

  private async testSystem(conn: Client): Promise<NodeConnectionTestResult> {
    try {
      const [user, os, nodeVer, disk, mem] = await Promise.all([
        this.execSSH(conn, 'whoami'),
        this.execSSH(conn, 'uname -s'),
        this.execSSH(conn, 'node -v || echo "no_node"'),
        this.execSSH(conn, 'df -BG --output=avail / | tail -1'),
        this.execSSH(conn, "free -m | awk '/Mem:/ {print $7}'"),
      ]);

      const diskGb = parseInt(disk.stdout.replace('G', '')) || 0;
      const memMb = parseInt(mem.stdout) || 0;

      const issues: string[] = [];

      if (os.stdout.toLowerCase() !== 'linux') {
        issues.push('Not Linux');
      }

      if (diskGb < 5) {
        issues.push(`Low disk ${diskGb}GB`);
      }

      if (memMb < 512) {
        issues.push(`Low RAM ${memMb}MB`);
      }

      if (issues.length) {
        return {
          ok: false,
          stage: 'system',
          code: 'NODE_INVALID',
          message: issues.join(', '),
          details: { diskGb, memMb },
        };
      }

      return {
        ok: true,
        stage: 'system',
        code: 'OK',
        message: 'System OK',
        details: {
          user: user.stdout,
          nodeVersion: nodeVer.stdout,
          diskGb,
          memMb,
        },
      };
    } catch (e: any) {
      return {
        ok: false,
        stage: 'system',
        code: 'NODE_INVALID',
        message: e.message,
      };
    }
  }

  private async testAgent(conn: Client): Promise<NodeConnectionTestResult> {
    try {
      const agent = await this.execSSH(conn, 'test -f /usr/local/bin/proxy-agent && echo 1 || echo 0');
      const proxy = await this.execSSH(conn, 'which 3proxy >/dev/null 2>&1 && echo 1 || echo 0');
      const writable = await this.execSSH(conn, 'test -w /etc/3proxy || echo 0');

      const agentInstalled = agent.stdout === '1';
      const proxyInstalled = proxy.stdout === '1';

      const issues = [];

      if (!proxyInstalled) issues.push('3proxy missing');

      // ⚠️ agent có thể chưa có khi onboarding → warning thôi
      return {
        ok: issues.length === 0,
        stage: 'agent',
        code: issues.length ? 'NODE_NOT_READY' : 'OK',
        message: issues.length ? issues.join(', ') : 'Agent OK',
        details: {
          agentInstalled,
          proxyInstalled,
        },
      };
    } catch (e: any) {
      return {
        ok: false,
        stage: 'agent',
        code: 'NODE_NOT_READY',
        message: e.message,
      };
    }
  }

  private async testCapability(conn: Client): Promise<NodeConnectionTestResult> {
    try {
      const [fd, ipv6] = await Promise.all([
        this.execSSH(conn, 'ulimit -n'),
        this.execSSH(conn, 'sysctl net.ipv6.conf.all.disable_ipv6 || echo "1"'),
      ]);

      const fdLimit = parseInt(fd.stdout) || 1024;
      const ipv6Enabled = ipv6.stdout.includes('= 0');

      const issues = [];

      if (fdLimit < 4096) {
        issues.push(`FD limit low: ${fdLimit}`);
      }

      if (!ipv6Enabled) {
        issues.push('IPv6 disabled');
      }

      return {
        ok: issues.length === 0,
        stage: 'capability',
        code: issues.length ? 'NODE_CAPABILITY_FAILED' : 'OK',
        message: issues.join(', ') || 'Capability OK',
        details: {
          fdLimit,
          ipv6Enabled,
        },
      };
    } catch (e: any) {
      return {
        ok: false,
        stage: 'capability',
        code: 'NODE_CAPABILITY_FAILED',
        message: e.message,
      };
    }
  }

  // ========================
  // ERROR MAPPER
  // ========================

  private mapSshError(err: any): NodeConnectionTestResult {
    const msg = err?.message || '';

    if (msg.includes('All configured authentication methods failed')) {
      return {
        ok: false,
        stage: 'ssh',
        code: 'AUTH_FAILED',
        message: 'Authentication failed',
      };
    }

    if (msg.includes('TIMEOUT')) {
      return {
        ok: false,
        stage: 'ssh',
        code: 'SSH_UNREACHABLE',
        message: 'Connection timeout',
      };
    }

    return {
      ok: false,
      stage: 'ssh',
      code: 'SSH_UNREACHABLE',
      message: msg,
    };
  }
}