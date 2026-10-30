import { BinaryReader } from './file/binary-reader';
import { Frame } from './frame';
import { ColorPalette } from './lemmings/color-palette';
import { PaletteImage } from './lemmings/palette-image';

/** manage the sprites need for the game skill panel */
export class SkillPanelSprites {

    private panelSprite!: Frame;
    private letterSprite: { [key: string]: Frame } = {};
    private numberSpriteLeft: Frame[] = [];
    private numberSpriteRight: Frame[] = [];
    private emptyNumberSprite!: Frame;

    /** return the sprite for the skill panel */
    public getPanelSprite(): Frame {
        return this.panelSprite;
    }

    /** return a green letter */
    public getLetterSprite(letter: string): Frame {
        return this.letterSprite[letter.toUpperCase()];
    }

    /** return a number letter */
    public getNumberSpriteLeft(number: number): Frame {
        return this.numberSpriteLeft[number];
    }

    /** return a number letter */
    public getNumberSpriteRight(number: number): Frame {
        return this.numberSpriteRight[number];
    }

    public getNumberSpriteEmpty(): Frame {
        return this.emptyNumberSprite;
    }

    constructor(fr2: BinaryReader | null, fr6: BinaryReader | null, colorPalette: ColorPalette) {
        if (!fr2 || !fr6) {
            this.createStandalonePanel();
            return;
        }

        /// read skill panel
        const paletteImg = new PaletteImage(320, 40);
        paletteImg.readImageData(fr6, 4);
        this.panelSprite = paletteImg.createFrame(colorPalette);

        /// read green panel letters
        const letters: string[] = ['%', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

        for (let l = 0; l < letters.length; l++) {
            const paletteImg = new PaletteImage(8, 16);
            paletteImg.readImageData(fr6, 3);
            this.letterSprite[letters[l]] = paletteImg.createFrame(colorPalette);
        }

        /// add space
        const emptyFrame = new Frame(8, 16);
        emptyFrame.fill(0, 0, 0);
        this.letterSprite[' '] = emptyFrame;

        const blackAndWithPalette = new ColorPalette();
        blackAndWithPalette.setColorRGB(1, 255, 255, 255);

        /// read panel skill-count number letters
        fr2.setOffset(0x1900);
        for (let i = 0; i < 10; i++) {
            const paletteImgRight = new PaletteImage(8, 8);
            paletteImgRight.readImageData(fr2, 1);
            paletteImgRight.setTransparencyByColorIndex(0);
            this.numberSpriteRight.push(paletteImgRight.createFrame(blackAndWithPalette));

            const paletteImgLeft = new PaletteImage(8, 8);
            paletteImgLeft.readImageData(fr2, 1);
            paletteImgLeft.setTransparencyByColorIndex(0);
            this.numberSpriteLeft.push(paletteImgLeft.createFrame(blackAndWithPalette));
        }

        /// add space
        this.emptyNumberSprite = new Frame(9, 8);
        this.emptyNumberSprite.fill(255, 255, 255);
    }

    /** A simple neutral bitmap HUD, with the Windows icon art drawn on top.
     * The game has only a handful of letters in its live status line. */
    private createStandalonePanel() {
        const patterns: Record<string, string[]> = {
            '0': ['111','101','101','101','111'], '1': ['010','110','010','010','111'],
            '2': ['111','001','111','100','111'], '3': ['111','001','111','001','111'],
            '4': ['101','101','111','001','001'], '5': ['111','100','111','001','111'],
            '6': ['111','100','111','101','111'], '7': ['111','001','010','010','010'],
            '8': ['111','101','111','101','111'], '9': ['111','101','111','001','111'],
            'O': ['111','101','101','101','111'], 'U': ['101','101','101','101','111'],
            'T': ['111','010','010','010','010'], 'I': ['111','010','010','010','111'],
            'N': ['101','111','111','111','101'], 'M': ['101','111','111','101','101'],
            'D': ['110','101','101','101','110'], 'E': ['111','100','110','100','111'], '%': ['101','001','010','100','101'],
            '-': ['000','000','111','000','000'], ' ': ['000','000','000','000','000'],
        };
        const draw = (frame: Frame, character: string, x: number, y: number, scaleY: number, color: number) => {
            for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
                if (patterns[character][row][col] === '1') for (let n = 0; n < scaleY; n++) frame.setPixel(x + col, y + row * scaleY + n, color);
            }
        };
        this.panelSprite = new Frame(320, 40);
        this.panelSprite.fill(0, 0, 0);
        for (const letter of Object.keys(patterns)) {
            const frame = new Frame(8, 16);
            draw(frame, letter, 2, 3, 2, ColorPalette.colorFromRGB(64, 224, 64));
            this.letterSprite[letter] = frame;
        }
        for (let number = 0; number < 10; number++) {
            const left = new Frame(8, 8), right = new Frame(8, 8);
            draw(left, String(number), 0, 1, 1, ColorPalette.colorFromRGB(255, 255, 255));
            draw(right, String(number), 4, 1, 1, ColorPalette.colorFromRGB(255, 255, 255));
            this.numberSpriteLeft.push(left);
            this.numberSpriteRight.push(right);
        }
        this.emptyNumberSprite = new Frame(9, 8);
        this.emptyNumberSprite.fill(255, 255, 255);
    }

}
