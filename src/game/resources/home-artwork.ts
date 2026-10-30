import { BinaryReader } from './file/binary-reader';
import { FileContainer } from './file/file-container';
import { getLemmingsFile } from './file/game-file-store';
import { Frame } from './frame';
import { MainImageSprites } from './main-image-sprites';
import { getWindowsGraphicsFile } from './file/windows-graphics-store';
import { decodeWindowsBmp } from './windows-bmp';

export interface HomeArtwork {
  logo: Frame;
  background: Frame;
}

/** Decode the player's own title-screen art directly from local storage. */
export async function loadHomeArtwork(): Promise<HomeArtwork | null> {
  const bytes = await getLemmingsFile('MAIN.DAT');
  if (!bytes) return null;

  const container = new FileContainer(new BinaryReader(bytes, 0, null, 'MAIN.DAT'));
  if (container.count() < 5) return null;
  const titleData = container.getPart(3);
  // Both decoded images must fit in this part; a partial import should leave the
  // home screen's own fallback visible instead of drawing a blank image.
  if (titleData.length < 0x9488) return null;
  const sprites = new MainImageSprites(titleData, container.getPart(4));
  const logo = sprites.getLogo();
  if (!logo.getMask().some(Boolean)) return null;
  return { logo, background: sprites.getBackground() };
}

/** Windows-only installations can use the splash artwork from their own disc. */
export async function loadWindowsHomeArtwork(): Promise<Frame | null> {
  const bytes = await getWindowsGraphicsFile('WLEMLOGO.BMP');
  if (!bytes) return null;
  const image = decodeWindowsBmp(new Uint8Array(bytes));
  const frame = new Frame(image.width, image.height);
  frame.getData().set(image.data);
  return frame;
}

/** Paint without creating a persistent URL or storing a copy of the image. */
export function paintHomeArtwork(canvas: HTMLCanvasElement, frame: Frame): boolean {
  const context = canvas.getContext('2d');
  if (!context) return false;
  canvas.width = frame.width;
  canvas.height = frame.height;
  context.putImageData(new ImageData(frame.getData(), frame.width, frame.height), 0, 0);
  return true;
}
