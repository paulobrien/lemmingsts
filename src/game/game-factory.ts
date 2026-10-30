import { GameConfig } from './config/game-config';
import { Game } from './game';
import { GameResources } from './game-resources';
import { GameTypes } from './game-types';
import { FileProvider } from './resources/file/file-provider';
import { ConfigReader } from './utilities/config-reader';
import { LevelConfig } from './config/level-config';
import { getWindowsGameFile } from './resources/file/windows-game-store';
import { parseWindowsLevelDatabase, type WindowsLevelGroup } from './resources/windows-level-database';
import type { GameMode } from './game-mode';

/** loads the config and provides an game-resources object */
export class GameFactory {

    private configReader: ConfigReader;
    private fileProvider: FileProvider;

    constructor(private rootPath: string, private edition: GameMode = 'dos') {
        this.fileProvider = new FileProvider(rootPath);

        const configFileReader = this.fileProvider.loadString('config.json');
        this.configReader = new ConfigReader(configFileReader);
    }


    /** return a game object to control/run the game */
    public async getGame(gameType: GameTypes, levelGroupIndex: number, levelIndex: number): Promise<Game | undefined> {

        /// load resources
        const res = await this.getGameResources(gameType);
        if (!res) {
            return;
        }

        return Game.loadLevel(res, levelGroupIndex, levelIndex);

    }

    /** return the config of a game type */
    public async getConfig(gameType: GameTypes): Promise<GameConfig | undefined> {
        const base = await this.configReader.getConfig(gameType);
        if (!base || this.edition !== 'windows' || gameType !== GameTypes.LEMMINGS) return base;
        const groups = await this.getWindowsGroups();
        const level = Object.assign(new LevelConfig(), base.level, {
            groups: groups.map(group => group.name),
            order: groups.map(group => group.levels.map((_, index) => index)),
        });
        return Object.assign(new GameConfig(), base, { level });
    }

    private async getWindowsGroups(): Promise<WindowsLevelGroup[]> {
        const bytes = await getWindowsGameFile('LEMMINGS.DB');
        if (!bytes) throw new Error('Windows level data is missing. Please add the Windows game files again.');
        return parseWindowsLevelDatabase(bytes);
    }

    /** return a Game Resources that gave access to images, maps, sounds  */
    public async getGameResources(gameType: GameTypes): Promise<GameResources | undefined> {

        const config = await this.getConfig(gameType);

        if (!config) {
            return;
        }

        return new GameResources(this.fileProvider, config, this.edition === 'windows' && gameType === GameTypes.LEMMINGS ? await this.getWindowsGroups() : undefined);



    }
}
