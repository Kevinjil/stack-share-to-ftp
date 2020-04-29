import FtpSrv from 'ftp-srv';
import StackFileSystem from './stack-file-system';

/**
 * First program argument is port. Default to 21.
 */
const port = Number(process.argv[2]) || 21;

/**
 * Second program argument is bind address. Default to 127.0.0.1.
 */
const bindaddr = process.argv[3] || '127.0.0.1';

// Create server.
const ftpServer = new FtpSrv({
  url: `ftp://${bindaddr}:${port}`,
  pasv_url: bindaddr,
  pasv_min: 10000,
  pasv_max: 10100,
  timeout: 300000,
});

/**
 * Handle logins to the FTP server by attempting to connect to the STACK API.
 */
ftpServer.on('login', async (data, resolve, reject) => {
  try {
    const fs = await StackFileSystem.create(data.connection, data.username, data.password);
    resolve({ fs });
  } catch (e) {
    reject(e);
  }
});

// Start the FTP server.
ftpServer.listen();
