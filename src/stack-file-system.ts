import { PassThrough } from 'stream';
import * as path from 'path';
import * as util from 'util';
import { FtpConnection, FileSystem } from 'ftp-srv';
import request, { CookieJar } from 'request';
import { createLogger } from 'bunyan';
import StackStats, { StackApiStats } from './stack-stats';

/**
 * A class implementing the original ftp-srv FileSystem by calling the STACK shared folder API.
 */
export default class StackFileSystem implements FileSystem {
  /**
   * The STACK API returns limits listings at 100 files per request.
   */
  private static readonly maxFiles = 100;

  private static readonly logger = createLogger({ name: 'StackFileSystem' });

  /**
   * Connection of FileSystem.
   */
  public readonly connection: FtpConnection;

  /**
   * Root path of FileSystem.
   */
  public readonly root: string = '/';

  /**
   * Private variable for storing the working directory.
   */
  private workingDir: string = '/';

  /**
   * The base URL to the shared folder API.
   */
  private baseUrl: string;

  /**
   * Cross-Site Request Forgery token handed out by the STACK API.
   */
  private csrfToken: string;

  /**
   * A container for the HTTP cookies used in API calls.
   */
  private cookieJar: CookieJar;

  /**
   * Creates a new StackFileSystem instance.
   * @param connection - The FTP client connection.
   * @param baseUrl - The base URL to the shared folder API.
   * @param csrfToken - The CSRF token handed out by the STACK api.
   * @param cookieJar - A container for the HTTP cookies used in API calls.
   */
  private constructor(
    connection: FtpConnection,
    baseUrl: string,
    csrfToken: string,
    cookieJar: CookieJar,
  ) {
    this.connection = connection;
    this.baseUrl = baseUrl;
    this.csrfToken = csrfToken;
    this.cookieJar = cookieJar;
  }

  /**
   * Create a new STACK filesystem by connecting to the STACK API.
   * @param connection - The FTP client connection that attempts to connect.
   * @param username - FTP username in format: <SHARE>@<STACK_DOMAIN>.
   * @param password - The password for of the shared folder.
   */
  public static async create(connection: FtpConnection, username: string, password: string):
  Promise<StackFileSystem> {
    this.logger.info({ action: 'create', username });
    const at = username.indexOf('@');
    const share = username.substr(0, at);
    const domain = username.substr(at + 1);
    const baseUrl = `https://${domain}/public-share/${share}/`;

    // Attempt login to fetch CSRF token and fill cookie jar.
    const cookieJar = request.jar();
    const res = await util.promisify(request.bind(null, ({
      baseUrl,
      url: 'info/',
      jar: cookieJar,
      method: 'POST',
      form: {
        password,
      },
    })))();
    if (res.statusCode !== 200) {
      throw new Error(`STACK login failed for user '${username}'.`);
    }

    // Login succeeded, create a file system instance.
    return new StackFileSystem(connection, baseUrl, res.headers['csrf-token'], cookieJar);
  }

  /**
   * @returns The public readonly working directory.
   */
  public get cwd(): string {
    return this.workingDir;
  }

  /**
   * @inheritdoc
   */
  currentDirectory(): string {
    return this.cwd;
  }

  /**
   * @inheritdoc
   */
  async get(fileName: string): Promise<any> {
    const clientPath = path.posix.join(this.cwd, fileName);
    StackFileSystem.logger.info({ client: this.connection.id, action: 'get', path: clientPath });
    // throw new Error('Method not implemented.');
    return {
      isDirectory: () => true,
    };
  }

  /**
   * @inheritdoc
   */
  async list(fileName?: string): Promise<any> {
    const clientPath = path.posix.join(this.cwd, fileName);
    StackFileSystem.logger.info({ client: this.connection.id, action: 'list', path: clientPath });

    let i = 0;
    let nodes: StackStats[] = [];
    let fetched = 0;
    do {
      // eslint-disable-next-line no-await-in-loop
      const res = await util.promisify(request.bind(null, ({
        baseUrl: this.baseUrl,
        url: 'list',
        jar: this.cookieJar,
        method: 'GET',
        json: true,
        qs: {
          type: 'folder',
          offset: i * StackFileSystem.maxFiles,
          limit: StackFileSystem.maxFiles,
          sortBy: 'default',
          order: 'asc',
          dir: clientPath,
        },
      })))();

      if (res.body && res.body.nodes) {
        fetched = res.body.nodes.length;
        nodes = nodes.concat(res.body.nodes.map((node: StackApiStats) => new StackStats(node)));
        i += 1;
      }
    } while (fetched === StackFileSystem.maxFiles);
    return nodes;
  }

  /**
   * @inheritdoc
   */
  async chdir(fileName?: string): Promise<string> {
    this.workingDir = path.posix.join(this.root, fileName);
    StackFileSystem.logger.info({ client: this.connection.id, action: 'cwd', path: this.cwd });
    return this.cwd;
  }

  /**
   * @inheritdoc
   */
  async write(fileName: string): Promise<any> {
    const clientPath = path.posix.join(this.cwd, fileName);
    StackFileSystem.logger.info({ client: this.connection.id, action: 'write', path: clientPath });
    const stream = new PassThrough();
    stream.pipe(request({
      baseUrl: this.baseUrl,
      url: `upload${clientPath}`,
      jar: this.cookieJar,
      method: 'PUT',
      headers: {
        'CSRF-Token': this.csrfToken,
      },
    }));
    return { stream, clientPath };
  }

  /**
   * @inheritdoc
   */
  async read(fileName: string): Promise<any> {
    const clientPath = path.posix.join(this.cwd, fileName);
    StackFileSystem.logger.info({ client: this.connection.id, action: 'read', path: clientPath });
    return request({
      baseUrl: this.baseUrl,
      url: 'download',
      jar: this.cookieJar,
      method: 'POST',
      form: {
        'CSRF-Token': this.csrfToken,
        'paths[]': clientPath,
      },
    });
  }

  /**
   * @inheritdoc
   */
  async delete(fileName: string): Promise<any> {
    const clientPath = path.posix.join(this.cwd, fileName);
    StackFileSystem.logger.info({ client: this.connection.id, action: 'delete', path: clientPath });
    throw new Error('Method not implemented.');
  }

  /**
   * @inheritdoc
   */
  async mkdir(fileName: string): Promise<any> {
    const clientPath = path.posix.join(this.cwd, fileName);
    StackFileSystem.logger.info({ client: this.connection.id, action: 'mkdir', path: clientPath });
    throw new Error('Method not implemented.');
  }

  /**
   * @inheritdoc
   */
  async rename(from: string, to: string): Promise<any> {
    const fromPath = path.posix.join(this.cwd, from);
    const toPath = path.posix.join(this.cwd, to);
    StackFileSystem.logger.info({
      client: this.connection.id, action: 'rename', from: fromPath, to: toPath,
    });
    throw new Error('Method not implemented.');
  }

  /**
   * @inheritdoc
   */
  async chmod(fileName: string, mode: string): Promise<any> {
    const clientPath = path.posix.join(this.cwd, fileName);
    StackFileSystem.logger.info({
      client: this.connection.id, action: 'chmod', path: clientPath, mode,
    });
    throw new Error('Method not implemented.');
  }

  /**
   * @inheritdoc
   */
  getUniqueName(): string {
    StackFileSystem.logger.info({ client: this.connection.id, action: 'unique-name' });
    throw new Error('Method not implemented.');
  }
}
