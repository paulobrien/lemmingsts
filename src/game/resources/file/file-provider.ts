import { BinaryReader } from './binary-reader';
import { getLemmingsFile } from './game-file-store';

/** Loads application configuration from the web and private game data locally. */
export class FileProvider {
  constructor(private rootPath: string) {}

  private createFullUrl(path: string, fileName?: string): string {
    return this.rootPath + (path ? '/' + path : '') + (fileName ? '/' + fileName : '');
  }

  public async loadBinary(path: string, filename?: string): Promise<BinaryReader> {
    if (path.toLowerCase() !== 'lemmings' || !filename) {
      throw new Error('Only original DOS Lemmings files are supported. Import them on this device to play.');
    }

    const buffer = await getLemmingsFile(filename);
    if (!buffer) throw new Error(`Game file ${filename} is missing. Import the original DOS Lemmings files on this device.`);
    return new BinaryReader(buffer, 0, null, filename);
  }

  public async loadString(path: string, filename?: string): Promise<string> {
    const url = this.createFullUrl(path, filename);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load game configuration (${response.status}).`);
    return response.text();
  }
}
