export interface StackApiStats {
  fileId: number,
  path: string,
  mimetype: string,
  etag: string,
  shareToken: string,
  expirationDate: string,
  hasSharePassword: boolean,
  shareTime: number,
  canUpload: boolean,
  fileSize: number,
  isFavorited: boolean,
  mtime: number,
  isPreviewable: boolean,
  mediaType: string,
  width: number,
  height: number
}

/* eslint-disable class-methods-use-this */
export default class StackStats {
  private readonly mimetype: string;

  public constructor(stat: StackApiStats) {
    this.mimetype = stat.mimetype;

    this.ino = stat.fileId;
    this.size = stat.fileSize;
    this.mtime = new Date(stat.mtime * 1000);

    this.name = stat.path.substr(stat.path.lastIndexOf('/') + 1);
  }

  public isFile(): boolean {
    return !this.isDirectory();
  }

  public isDirectory(): boolean {
    return this.mimetype === 'httpd/unix-directory';
  }

  public isBlockDevice(): boolean {
    return false;
  }

  public isCharacterDevice(): boolean {
    return false;
  }

  public isSymbolicLink(): boolean {
    return false;
  }

  public isFIFO(): boolean {
    return false;
  }

  public isSocket(): boolean {
    return false;
  }

  public readonly dev: number;

  public readonly ino: number;

  public readonly mode: number;

  public readonly nlink: number;

  public readonly uid: number;

  public readonly gid: number;

  public readonly rdev: number;

  public readonly size: number;

  public readonly blksize: number;

  public readonly blocks: number;

  public readonly aTimeMs: number;

  public readonly mTimeMs: number;

  public readonly cTimeMs: number;

  public readonly birthtimeMs: number;

  public readonly atime: Date;

  public readonly mtime: Date;

  public readonly ctime: Date;

  public readonly birthtime: Date;

  public readonly name: string;
}
