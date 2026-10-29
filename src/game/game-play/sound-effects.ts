/** Zero-based ADLIB.DAT indices, with negative IDs for synthesized speaker cues. */
export enum SoundEffect {
    Digger = -1,
    Basher = -2,
    Miner = -3,
    Nuke = -4,
    SelectSkill = 0,
    Entrance = 1,
    LetsGo = 2,
    Assign = 3,
    OhNo = 4,
    Splat = 7,
    Steel = 9,
    Explosion = 11,
    Fire = 12,
    Exit = 15,
    Drowning = 16,
    BuilderWarning = 17,
}

// Mapping cross-checked against the DOS driver calls in
// https://github.com/Eric-Lautanen/lemmings/blob/main/game.js
