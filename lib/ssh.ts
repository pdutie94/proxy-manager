import { NodeSSH } from 'node-ssh';
import { Node } from '@prisma/client';

export interface SSHConnectionResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface ProxyConfig {
  port: number;
  protocol: 'HTTP' | 'SOCKS4' | 'SOCKS5';
  username?: string;
  password?: string;
  externalIp?: string; 
}

function normalizePrivateKey(key: string): string {
  return key
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

export class SSHService {
  private static connections: Map<number, NodeSSH> = new Map();

  /**
   * Kết nối SSH v13.2.0
   */
  static async connect(server: Server): Promise<NodeSSH> {
    try {
      if (this.connections.has(server.id)) {
        const conn = this.connections.get(server.id)!;
        // Kiểm tra xem connection còn sống không (tùy chọn)
        return conn;
      }

      const ssh = new NodeSSH();
      const connectionConfig: any = {
        host: server.host,
        port: server.sshPort || 22,
        username: server.sshUsername,
        readyTimeout: 20000,
      };

      if (server.sshPrivateKey) {
        // connectionConfig.privateKey = normalizePrivateKey(server.sshPrivateKey);
        connectionConfig.privateKey = server.sshPrivateKey;
        const keyPassphrase = (server as any).sshKeyPassphrase;
        if (keyPassphrase) connectionConfig.passphrase = keyPassphrase;
      } else if (server.sshPassword) {
        connectionConfig.password = server.sshPassword;
      }

      await ssh.connect(connectionConfig);
      this.connections.set(server.id, ssh);
      
      console.log(`[SSH] Connected to ${server.host}`);
      return ssh;
    } catch (error) {
      console.error(`[SSH] Connection failed to ${server.host}:`, error);
      throw error;
    }
  }

  /**
   * Cài đặt 3proxy từ Source GitHub
   */
  static async install3Proxy(server: Server): Promise<SSHConnectionResult> {
    try {
      const ssh = await this.connect(server);

      console.log('--- Đang bắt đầu cài đặt 3proxy từ Source ---');

      // Gom các lệnh build vào một chuỗi để chạy cho nhanh
      const buildCommands = [
        'sudo apt-get update',
        'sudo apt-get install -y git build-essential',
        'cd ~ && rm -rf 3proxy', // Xóa bản cũ nếu có
        'git clone https://github.com/3proxy/3proxy.git',
        'cd 3proxy && sudo make -f Makefile.Linux',
        'sudo mkdir -p /etc/3proxy /var/log/3proxy /usr/local/bin',
        'sudo cp ~/3proxy/bin/3proxy /usr/local/bin/',
        'sudo chmod +x /usr/local/bin/3proxy'
      ].join(' && ');

      const res = await ssh.execCommand(buildCommands);
      if (res.code !== 0) throw new Error(`Build failed: ${res.stderr}`);

      // Tạo file cấu hình mặc định
      const baseConfig = `#daemon
pidfile /run/3proxy.pid
nserver 8.8.8.8
nserver 1.1.1.1
stacksize 65536
timeouts 1 5 30 60 180 1800 15 60
log /var/log/3proxy/3proxy.log D
rotate 30
auth strong
`;

      await ssh.execCommand(`sudo bash -c "cat << 'EOF' > /etc/3proxy/3proxy.cfg\n${baseConfig}\nEOF"`);

      // Tạo lệnh chạy 3proxy lúc khởi động (Systemd Service)
      const serviceConfig = `[Unit]
Description=3proxy Proxy Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/3proxy /etc/3proxy/3proxy.cfg
Restart=always

[Install]
WantedBy=multi-user.target`;

      await ssh.execCommand(`sudo bash -c "cat << 'EOF' > /etc/systemd/system/3proxy.service\n${serviceConfig}\nEOF"`);
      await ssh.execCommand('sudo systemctl daemon-reload && sudo systemctl enable 3proxy && sudo systemctl start 3proxy');

      return { success: true, message: '3proxy installed from source and service started' };
    } catch (error: any) {
      console.error('Install error:', error);
      return { success: false, message: 'Installation failed', error: error.message };
    }
  }

  static async createProxy(server: Server, proxy: ProxyConfig): Promise<SSHConnectionResult> {
    try {
      const ssh = await this.connect(server);
      const configChunk = this.generateProxyConfig(proxy);

      // Append nội dung vào cuối file bằng >>
      await ssh.execCommand(`sudo bash -c "cat << 'EOF' >> /etc/3proxy/3proxy.cfg\n${configChunk}\nEOF"`);

      await ssh.execCommand('sudo killall -s USR1 3proxy || sudo systemctl restart 3proxy');
      return { success: true, message: 'Created' };
    } catch (error: any) {
      return { success: false, message: 'Failed', error: error.message };
    }
  }

  /**
   * Xóa Proxy dựa trên Port
   */
  static async deleteProxy(server: Server, port: number): Promise<SSHConnectionResult> {
    try {
      const ssh = await this.connect(server);

      // Xóa dòng chứa port và các dòng liên quan auth ngay phía trên nếu có
      // Ở đây ta đơn giản hóa bằng cách xóa dòng chứa -p[Port]
      await ssh.execCommand(`sudo sed -i '/-p${port}/d' /etc/3proxy/3proxy.cfg`);
      await ssh.execCommand('sudo killall -s USR1 3proxy');

      return { success: true, message: `Proxy on port ${port} deleted` };
    } catch (error: any) {
      return { success: false, message: 'Failed to delete proxy', error: error.message };
    }
  }

  /**
   * Sinh dòng cấu hình chuẩn 3proxy
   */
  private static generateProxyConfig(proxy: ProxyConfig): string {
    const { port, protocol, username, password, externalIp } = proxy;
    let config = '\n# --- New Proxy ---\n';

    if (username && password) {
      config += `auth strong\nusers ${username}:CL:${password}\nallow ${username}\n`;
    } else {
      config += `auth none\n`;
    }

    const cmd = protocol.toLowerCase() === 'http' ? 'proxy' : 'socks';
    const ext = externalIp ? `-e${externalIp}` : '';
    
    config += `${cmd} -p${port} ${ext}\nflush\n`;

    return config;
  }

  static async disconnect(serverId: number): Promise<void> {
    const ssh = this.connections.get(serverId);
    if (ssh) {
      await ssh.dispose();
      this.connections.delete(serverId);
    }
  }

  static async testConnection(server: Server): Promise<SSHConnectionResult> {
    try {
      const ssh = await this.connect(server);
      const res = await ssh.execCommand('uptime');
      return {
        success: res.code === 0,
        message: 'Connection OK'
      };
    } catch (error: any) {
      return { success: false, message: 'SSH Failed', error: error.message };
    }
  }

  /**
   * Kiểm tra 3proxy đã được cài đặt chưa
   */
  static async check3ProxyInstalled(server: Server): Promise<boolean> {
    try {
      const ssh = await this.connect(server);
      // Kiểm tra binary 3proxy có tồn tại không
      const checkBin = await ssh.execCommand('which 3proxy');
      if (checkBin.code !== 0) return false;

      // Kiểm tra service có tồn tại và chạy không
      const checkService = await ssh.execCommand('systemctl is-active 3proxy');
      return checkService.code === 0 || checkService.stdout.trim() === 'active';
    } catch (error) {
      console.error(`[SSH] Failed to check 3proxy on ${server.host}:`, error);
      return false;
    }
  }

  /**
   * Kiểm tra port có đang listen không
   */
  static async checkProxyPort(server: Server, port: number): Promise<boolean> {
    try {
      const ssh = await this.connect(server);
      // Dùng ss (thay thế netstat, nhanh hơn)
      const checkPort = await ssh.execCommand(`ss -tlnp | grep -q ':${port}' && echo "LISTENING" || echo "NOT_LISTENING"`);
      return checkPort.stdout.trim() === 'LISTENING';
    } catch (error) {
      console.error(`[SSH] Failed to check port ${port} on ${server.host}:`, error);
      return false;
    }
  }

  /**
   * Đọc và parse file cấu hình 3proxy từ server
   * Trả về danh sách proxy config đã parse
   */
  static async parseProxyConfig(server: Server): Promise<ProxyConfig[]> {
    try {
      const ssh = await this.connect(server);

      // Đọc nội dung file 3proxy.cfg
      const result = await ssh.execCommand('sudo cat /etc/3proxy/3proxy.cfg');
      if (result.code !== 0) {
        throw new Error(`Failed to read config file: ${result.stderr}`);
      }

      const configContent = result.stdout;
      const proxies: ProxyConfig[] = [];

      // Parse từng block cấu hình (phân cách bởi flush hoặc section mới)
      const lines = configContent.split('\n');
      let currentAuth: 'none' | 'strong' = 'none';
      let currentUser: string | undefined;
      let currentPassword: string | undefined;
      let currentExternalIp: string | undefined;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Bỏ qua comment và empty lines
        if (!line || line.startsWith('#')) continue;

        // Parse auth type
        if (line.startsWith('auth ')) {
          const authType = line.split(' ')[1]?.toLowerCase();
          currentAuth = authType === 'strong' ? 'strong' : 'none';
          currentUser = undefined;
          currentPassword = undefined;
          continue;
        }

        // Parse users (format: users username:CL:password)
        if (line.startsWith('users ')) {
          const userMatch = line.match(/users\s+(\w+):CL:(\S+)/);
          if (userMatch) {
            currentUser = userMatch[1];
            currentPassword = userMatch[2];
          }
          continue;
        }

        // Parse external IP
        if (line.includes('external ')) {
          const extMatch = line.match(/external\s+(\S+)/);
          if (extMatch) {
            currentExternalIp = extMatch[1];
          }
          continue;
        }

        // Parse proxy command (HTTP proxy)
        // Format: proxy -pPORT hoặc proxy -pPORT -eIP
        const proxyMatch = line.match(/proxy\s+-p(\d+)(?:\s+-e(\S+))?/);
        if (proxyMatch) {
          const port = parseInt(proxyMatch[1]);
          const externalIp = proxyMatch[2] || currentExternalIp;

          proxies.push({
            port,
            protocol: 'HTTP',
            username: currentAuth === 'strong' ? currentUser : undefined,
            password: currentAuth === 'strong' ? currentPassword : undefined,
            externalIp
          });
          continue;
        }

        // Parse socks command (SOCKS proxy)
        // Format: socks -pPORT, socks4 -pPORT, socks5 -pPORT
        const socksMatch = line.match(/socks(\d?)\s+-p(\d+)(?:\s+-e(\S+))?/);
        if (socksMatch) {
          const port = parseInt(socksMatch[2]);
          const externalIp = socksMatch[3] || currentExternalIp;
          const socksVersion = socksMatch[1]; // '4', '5', or ''

          // Mặc định SOCKS5, nếu socks4 thì dùng SOCKS4
          const protocol: 'HTTP' | 'SOCKS4' | 'SOCKS5' = socksVersion === '4' ? 'SOCKS4' : 'SOCKS5';

          proxies.push({
            port,
            protocol,
            username: currentAuth === 'strong' ? currentUser : undefined,
            password: currentAuth === 'strong' ? currentPassword : undefined,
            externalIp
          });
          continue;
        }

        // Reset khi gặp flush
        if (line === 'flush') {
          currentAuth = 'none';
          currentUser = undefined;
          currentPassword = undefined;
          currentExternalIp = undefined;
        }
      }

      console.log(`[SSH] Parsed ${proxies.length} proxies from config on ${server.host}`);
      return proxies;
    } catch (error) {
      console.error(`[SSH] Failed to parse proxy config from ${server.host}:`, error);
      throw error;
    }
  }
}