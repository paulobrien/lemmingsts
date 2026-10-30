import { GameTypes } from '../game-types';
import { MapObject } from '../game-play/map-object';
import { SkillTypes } from '../game-play/skill-types';
import { Trigger } from '../game-play/trigger';
import { DisplayImage } from '../view/display-image';
import { ColorPalette } from './lemmings/color-palette';
import { LevelElement } from './lemmings/level-element';
import { LevelProperties } from './lemmings/level-properties';
import { ObjectImageInfo } from './lemmings/object-image-info';
import { Rectangle as SteelRectangle } from './lemmings/rectangle';
import { TriggerTypes } from './lemmings/trigger-types';
import { Mask } from './mask';
import { SolidLayer } from './solid-layer';
import { WindowsTerrainLayer } from './windows-terrain-layer';

interface ProtectionRegion { x: number; y: number; width: number; height: number; flag: number }
/** Layout metadata for optional Windows presentation; DOS physics is unchanged. */
export interface WindowsTerrainSource {
    graphicSet: number;
    special: boolean;
    pieces: readonly LevelElement[];
    /** One object type per placed object and the starting frame for each type. */
    objectTypes?: readonly number[];
    objectFrameStarts?: readonly number[];
}

/** Level Data */
export class Level {

    /** the background image */
    private groundImage: Uint8ClampedArray;
    private windowsTerrain?: WindowsTerrainLayer;
    private windowsTerrainSource?: WindowsTerrainSource;
    // DOS uses an object map of 4×4 pixel cells, independent of terrain pixels.
    // Lemmix's ReadObjectMap / InitializeObjectMap document its alignment and
    // overwrite order: https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas
    private terrainProtection: Uint8Array;
    private blockerFieldAt: ((x: number, y: number) => boolean) | null = null;
    private readonly protectionWidth: number;
    private readonly protectionHeight: number;
    private steelAreas: ProtectionRegion[] = [];
    private objectAreas: ProtectionRegion[] = [];

    /** the background mask 0=noGround / 1=ground */
    public groundMask: SolidLayer;

    /** objects on the map: entrance/exit/traps */
    public objects: MapObject[] = [];

    public entrances: LevelElement[] = [];

    public triggers: Trigger[] = [];


    public gameType: GameTypes;
    public levelMode: number;
    public levelIndex: number;

    public name = '';
    public width = 0;
    public height = 0;
    public releaseRate = 0;
    public releaseCount = 0;
    public needCount = 0;
    public timeLimit = 0;
    public skills: number[] = new Array(SkillTypes.length());
    public screenPositionX = 0;

    public isSuperLemming = false;

    public colorPalette: ColorPalette;
    public groundPalette: ColorPalette;
    //public previewPalette: ColorPalette;


    constructor(
        width: number,
        height: number,
        gameType: GameTypes,
        levelIndex: number,
        levelMode: number,
        levelProperties: LevelProperties,

        screenPositionX: number,
        isSuperLemming: boolean,

        groundImage: Uint8ClampedArray,
        solidLayer: SolidLayer,

        colorPalette: ColorPalette, 
        groundPalette: ColorPalette) {

    
        this.width = width;
        this.height = height;
        this.gameType = gameType;

        this.name = levelProperties.levelName;
        this.releaseRate = levelProperties.releaseRate;
        this.releaseCount = levelProperties.releaseCount;
        this.needCount = levelProperties.needCount;
        this.timeLimit = levelProperties.timeLimit;
        this.skills = levelProperties.skills;

        this.screenPositionX = screenPositionX;
        this.isSuperLemming = isSuperLemming;

        this.levelIndex = levelIndex;
        this.levelMode = levelMode;


        this.groundImage = groundImage;
        this.protectionWidth = Math.ceil(width / 4);
        this.protectionHeight = Math.ceil(height / 4);
        this.terrainProtection = new Uint8Array(this.protectionWidth * this.protectionHeight);
        this.groundMask = solidLayer;
        this.colorPalette = colorPalette;
        this.groundPalette = groundPalette;
    }


    /** set the map objects of this level and update trigger */
    public setMapObjects(objects: LevelElement[], objectImg: ObjectImageInfo[]): void {
        this.entrances = [];
        this.triggers = [];
        this.objects = [];
        this.objectAreas = [];

        /// process all objects
        for (let i = 0; i < objects.length; i++) {
            const ob = objects[i];
            const objectInfo = objectImg[ob.id];

            const flag = objectInfo.triggerEffectId === TriggerTypes.ONWAY_LEFT ? 2
                : objectInfo.triggerEffectId === TriggerTypes.ONWAY_RIGHT ? 4
                    : objectInfo.triggerEffectId === TriggerTypes.STEEL ? 1
                        : objectInfo.triggerEffectId === TriggerTypes.DROWN ? 8 : 0;
            // Original object origins are aligned to the four-pixel object grid.
            this.objectAreas.push({ x: Math.floor(ob.x / 4) * 4 + objectInfo.triggerLeft,
                y: Math.floor(ob.y / 4) * 4 + objectInfo.triggerTop,
                width: objectInfo.triggerWidth, height: objectInfo.triggerHeight, flag });

            /// add object
            const newMapObject = new MapObject(ob, objectInfo);
            this.objects.push(newMapObject);

            /// add entrances
            if (ob.id == 1) this.entrances.push(ob);

            /// add triggers
            if (objectInfo.triggerEffectId != 0 && objectInfo.triggerEffectId !== TriggerTypes.ONWAY_LEFT &&
                objectInfo.triggerEffectId !== TriggerTypes.ONWAY_RIGHT && objectInfo.triggerEffectId !== TriggerTypes.STEEL &&
                objectInfo.triggerWidth > 0 && objectInfo.triggerHeight > 0) {
                // Object-map origins are rounded down to four-pixel cells.
                const x1 = Math.floor(ob.x / 4) * 4 + objectInfo.triggerLeft;
                const y1 = Math.floor(ob.y / 4) * 4 + objectInfo.triggerTop;

                const x2 = x1 + objectInfo.triggerWidth - 1;
                const y2 = y1 + objectInfo.triggerHeight - 1;

                // A triggered trap is busy until its animation finishes. In
                // DOS it starts at frame 1 and advances after lemmings update.
                const trap = objectInfo.triggerEffectId === TriggerTypes.TRAP;
                const duration = trap ? Math.max(1, objectInfo.frameCount - 1) : 0;
                const newTrigger = new Trigger(objectInfo.triggerEffectId, x1, y1, x2, y2,
                    duration, objectInfo.trapSoundEffectId, trap ? newMapObject : null,
                    trap ? tick => newMapObject.activateTrap(tick) : undefined);

                this.triggers.push(newTrigger);
            }

        }
        this.rebuildProtection();
    }

    /** Install the rectangular steel areas decoded from the DOS level data. */
    public setSteelAreas(areas: readonly SteelRectangle[]): void {
        this.steelAreas = areas.map(area => ({ ...area, flag: 1 }));
        this.rebuildProtection();
    }

    /** Overlay live blocker object-map cells on static steel and objects. */
    public setBlockerFieldLookup(lookup: (x: number, y: number) => boolean): void {
        this.blockerFieldAt = lookup;
    }

    private rebuildProtection(): void {
        this.terrainProtection.fill(0);
        // Interactive objects are applied after steel and replace overlapping cells.
        for (const area of [...this.steelAreas, ...this.objectAreas]) {
            if (area.width <= 0 || area.height <= 0) continue;
            const left = Math.max(0, Math.floor(area.x / 4));
            const top = Math.max(0, Math.floor(area.y / 4));
            const right = Math.min(this.protectionWidth, Math.ceil((area.x + area.width) / 4));
            const bottom = Math.min(this.protectionHeight, Math.ceil((area.y + area.height) / 4));
            for (let row = top; row < bottom; row++) {
                for (let column = left; column < right; column++) {
                    this.terrainProtection[row * this.protectionWidth + column] = area.flag;
                }
            }
        }
    }

    /** Steel blocks every destructive skill; arrows restrict horizontal digging only. */
    public isProtectedAt(x: number, y: number, direction: -1 | 0 | 1 = 0): boolean {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        if (this.blockerFieldAt?.(x, y)) return false;
        const flags = this.terrainProtection[Math.floor(y / 4) * this.protectionWidth + Math.floor(x / 4)];
        return flags === 1 || (direction === 1 && flags === 2) || (direction === -1 && flags === 4);
    }

    /** The DOS bomber removes no terrain when its centre is in steel or water. */
    public isExplosionProtectedAt(x: number, y: number): boolean {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        if (this.blockerFieldAt?.(x, y)) return false;
        const flag = this.terrainProtection[Math.floor(y / 4) * this.protectionWidth + Math.floor(x / 4)];
        return flag === 1 || flag === 8;
    }

    /** DOS original's miner also turns back on right-pointing arrows when facing right. */
    public isMinerProtectedAt(x: number, y: number, direction: -1 | 1): boolean {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        if (this.blockerFieldAt?.(x, y)) return false;
        const flags = this.terrainProtection[Math.floor(y / 4) * this.protectionWidth + Math.floor(x / 4)];
        return flags === 1 || flags === 4 || (direction === 1 && flags === 2);
    }

    /** check if a y-position is out of the level */
    public isOutOfLevel(y: number): boolean {
        return ((y >= this.height) || (y <= 0));
    }

    /** return the layer that defines if a pixel in the level is solid */
    public getGroundMaskLayer(): SolidLayer {
        return this.groundMask;
    }

    /** Attach optional presentation data without changing the physics mask. */
    public setWindowsTerrain(layer: WindowsTerrainLayer | undefined): void {
        if (layer && (layer.logicalWidth !== this.width || layer.logicalHeight !== this.height)) {
            throw new Error('Windows terrain dimensions do not match the level.');
        }
        this.windowsTerrain = layer;
    }

    public getWindowsTerrain(): WindowsTerrainLayer | undefined { return this.windowsTerrain; }

    public setWindowsTerrainSource(source: WindowsTerrainSource): void { this.windowsTerrainSource = source; }
    public getWindowsTerrainSource(): WindowsTerrainSource | undefined { return this.windowsTerrainSource; }




    /** Clear with the complete DOS mask. Protection is checked by the acting
     * lemming's object-map probe, not by each mask pixel: a mask edge may
     * remove protected terrain, matching the original's known quirks. */
    public clearGroundWithMask(mask: Mask, x: number, y: number) {
        x += mask.offsetX;
        y += mask.offsetY;

        for (let dY = 0; dY < mask.height; dY++) {
            for (let dX = 0; dX < mask.width; dX++) {
                if (!mask.at(dX, dY)) {
                    this.clearGroundAt(x + dX, y + dY);
                }
            }
        }
    }

    /** set a point in the map to solid ground  */
    public setGroundAt(x: number, y: number, palletIndex: number) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this.groundMask.setGroundAt(x, y);

        const index = (y * this.width + x) * 4;
        this.groundImage[index + 0] = this.colorPalette.getR(palletIndex);
        this.groundImage[index + 1] = this.colorPalette.getG(palletIndex);
        this.groundImage[index + 2] = this.colorPalette.getB(palletIndex);
        // Erased terrain and special-map backgrounds can be transparent.
        // New builder bricks must still be visible on those pixels.
        this.groundImage[index + 3] = 255;
        this.windowsTerrain?.setGroundAt(x, y, (this.colorPalette.getR(palletIndex) << 16) |
            (this.colorPalette.getG(palletIndex) << 8) | this.colorPalette.getB(palletIndex));
    }

    /** checks if a point is solid ground  */
    public hasGroundAt(x: number, y: number): boolean {
        return this.groundMask.hasGroundAt(x, y);
    }


    /** clear a point  */
    public clearGroundAt(x: number, y: number) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this.groundMask.clearGroundAt(x, y);

        const index = (y * this.width + x) * 4;

        this.groundImage[index + 0] = 0; // R
        this.groundImage[index + 1] = 0; // G
        this.groundImage[index + 2] = 0; // B
        this.windowsTerrain?.clearGroundAt(x, y);
    }




    /** render ground to display */
    public render(gameDisplay: DisplayImage) {
        gameDisplay.initSize(this.width, this.height);
        const native = this.windowsTerrain;
        gameDisplay.setNativeBackground(native?.pixels ?? null, native?.width, native?.height);
        gameDisplay.setBackground(this.groundImage, this.groundMask);
    }

}

