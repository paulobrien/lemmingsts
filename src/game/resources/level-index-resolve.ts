import { GameConfig } from '../config/game-config';


export class LevelIndexType {
  /** Number of the file */
  public fileId: number = 0;

  /** container index in the file */
  public partIndex: number = 0;

  /** use the odd table information for this entry */
  public useOddTable: boolean = false;

  /** Index into the odd table for the underlying level file and part. */
  public levelNumber: number = 0;
}


/** matches the Level-Mode + Level-Index to a level-file and level-file-index */
export class LevelIndexResolve {

  constructor(private config: GameConfig) {

  }


  public resolve(levelMode: number, levelIndex: number): LevelIndexType | null {

    let levelOrderList = this.config.level.order;
    if (levelOrderList.length <= levelMode) {
      return null;
    }
    if (levelMode < 0) {
      return null;
    }

    let levelOrder = levelOrderList[levelMode];
    if (levelOrder.length <= levelIndex) {
      return null;
    }
    if (levelIndex < 0) {
      return null;
    }

    let levelOrderConfig = levelOrder[levelIndex];

    let liType = new LevelIndexType();

    liType.fileId = Math.abs((levelOrderConfig / 10) | 0);
    liType.partIndex = Math.abs((levelOrderConfig % 10) | 0);
    liType.useOddTable = (levelOrderConfig < 0);

    // The original DOS odd table contains one record per physical level slot,
    // with eight slots in each LEVELnnn.DAT container. Negative order entries
    // refer back to those physical slots, not the displayed difficulty order.
    liType.levelNumber = liType.fileId * 8 + liType.partIndex;


    return liType;
  }
}

