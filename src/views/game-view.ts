import { computed, defineComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Game } from '@/game/game';
import { GameFactory } from '@/game/game-factory';
import { GameResources } from '@/game/game-resources';
import { GameStateTypes } from '@/game/game-state-types';
import { GameTypes } from '@/game/game-types';
import { CommandReleaseRateDecrease } from '@/game/game-play/commands/command-release-rate-decrease';
import { CommandReleaseRateIncrease } from '@/game/game-play/commands/command-release-rate-increase';
import { CommandNuke } from '@/game/game-play/commands/command-nuke';
import { CommandSelectSkill } from '@/game/game-play/commands/command-select-skill';
import { SkillTypes } from '@/game/game-play/skill-types';
import { readSettings, recordCompletion, saveSettings } from '@/game/progress';
import { getTestedSolution } from '@/game/solutions/tested-solutions';
import { Level } from '@/game/resources/level';
import { AudioPlayer } from '@/game/resources/sound/audio-player';
import { SoundEffectsPlayer } from '@/game/resources/sound/sound-effects-player';
import { Stage } from '@/game/view/stage';
import { useGameFullscreen } from './use-game-fullscreen';
import './game-fullscreen.css';

const skillButtons = [
    { name: 'Climb', type: SkillTypes.CLIMBER }, { name: 'Float', type: SkillTypes.FLOATER },
    { name: 'Bomb', type: SkillTypes.BOMBER }, { name: 'Block', type: SkillTypes.BLOCKER },
    { name: 'Build', type: SkillTypes.BUILDER }, { name: 'Bash', type: SkillTypes.BASHER },
    { name: 'Mine', type: SkillTypes.MINER }, { name: 'Dig', type: SkillTypes.DIGGER },
];

export default defineComponent({
    setup() {
        const route = useRoute();
        const router = useRouter();
        const gamePage = ref<HTMLElement | null>(null);
        const pauseControl = ref<HTMLButtonElement | null>(null);
        const pauseHeading = ref<HTMLElement | null>(null);
        const gameCanvas = ref<HTMLCanvasElement | null>(null);
        const { fullscreenActive, fullscreenMode, toggleFullscreen } = useGameFullscreen(gamePage);
        const level = ref<Level | null>(null);
        const levelIndex = ref(Math.max(0, Number(route.query.level) || 0));
        const groupIndex = ref(Math.max(0, Number(route.query.group) || 0));
        const groupName = ref('');
        const error = ref('');
        const loading = ref(true);
        const playing = ref(false);
        const paused = ref(false);
        const finished = ref(false);
        const resultMessage = ref('');
        const visibleHintCount = ref(0);
        const nukeArmed = ref(false);
        const selectedSkill = ref<SkillTypes>(SkillTypes.CLIMBER);
        const skillCounts = ref<Record<number, number>>({});
        const releaseRate = ref(0);
        const gameTime = ref('');
        const settings = readSettings();
        const speed = ref(settings.speed);
        const musicEnabled = ref(settings.musicEnabled);
        const soundEnabled = ref(settings.soundEnabled);
        const gameType = (Number(route.params.gameType) || GameTypes.LEMMINGS) as GameTypes;
        const factory = new GameFactory(`${import.meta.env.BASE_URL}data`);
        let resources: GameResources | null = null;
        let game: Game | null = null;
        let stage: Stage | null = null;
        let music: AudioPlayer | null = null;
        let effects: SoundEffectsPlayer | null = null;
        let disposed = false;
        let loadGeneration = 0;
        let musicGeneration = 0;

        const title = computed(() => level.value?.name || 'Loading level');
        const canPlay = computed(() => !!level.value && !loading.value && !error.value);
        const hints = computed(() => gameType === GameTypes.LEMMINGS
            ? getTestedSolution(groupIndex.value, levelIndex.value)?.hints ?? [] : []);

        function stopMusic() {
            musicGeneration++;
            music?.stop();
            music = null;
        }

        function updateStats() {
            if (!game) return;
            const skills = game.getGameSkills();
            const counts: Record<number, number> = {};
            for (const skill of skillButtons) counts[skill.type] = skills.getSkill(skill.type);
            skillCounts.value = counts;
            selectedSkill.value = skills.getSelectedSkill();
            releaseRate.value = game.getVictoryCondition().getCurrentReleaseRate();
            gameTime.value = game.getGameTimer().getGameLeftTimeString();
        }

        function disposeGame() {
            effects?.stop();
            effects = null;
            game?.stop();
            game = null;
            stage?.clearInputBindings();
            playing.value = false;
            paused.value = false;
        }

        async function loadLevel() {
            const generation = ++loadGeneration;
            disposeGame();
            stopMusic();
            loading.value = true;
            error.value = '';
            finished.value = false;
            nukeArmed.value = false;
            resultMessage.value = '';
            visibleHintCount.value = 0;
            try {
                const config = await factory.getConfig(gameType);
                if (!config) throw new Error('The selected game is not available.');
                const group = config.level.order[groupIndex.value];
                if (!group || levelIndex.value >= group.length) throw new Error('The selected level is not available.');
                groupName.value = config.level.groups[groupIndex.value] || `Group ${groupIndex.value + 1}`;
                resources = await factory.getGameResources(gameType) || null;
                if (!resources) throw new Error('Could not load the game files.');
                const nextLevel = await resources.getLevel(groupIndex.value, levelIndex.value);
                if (!nextLevel) throw new Error('Could not load this level.');
                if (disposed || generation !== loadGeneration) return;
                level.value = nextLevel;
                if (stage) {
                    const display = stage.getGameDisplay();
                    stage.resetFade();
                    display.clear();
                    nextLevel.render(display);
                    display.setScreenPosition(nextLevel.screenPositionX, 0);
                    display.redraw();
                }
            } catch (reason) {
                if (generation === loadGeneration) error.value = reason instanceof Error ? reason.message : 'Could not load this level. Check your game files and try again.';
            } finally {
                if (generation === loadGeneration) loading.value = false;
            }
        }

        async function start() {
            if (!canPlay.value || !stage || loading.value) return;
            if (game) {
                if (!finished.value) {
                    game.getGameTimer().continue();
                    paused.value = false;
                }
                return;
            }
            loading.value = true;
            error.value = '';
            const generation = loadGeneration;
            try {
                const nextGame = await factory.getGame(gameType, groupIndex.value, levelIndex.value);
                if (!nextGame) throw new Error('Could not start this level.');
                if (disposed || generation !== loadGeneration || !stage) {
                    nextGame.stop();
                    return;
                }
                game = nextGame;
                const activeResources = resources;
                effects = activeResources ? new SoundEffectsPlayer(index => activeResources.getSoundTrack(index)) : null;
                game.onSoundEffect.on(effect => {
                    if (effect !== undefined && soundEnabled.value && playing.value && !paused.value) void effects?.play(effect);
                });
                stage.clearInputBindings();
                game.setGameDisplay(stage.getGameDisplay());
                game.setGuiDisplay(stage.getGuiDisplay());
                stage.getGuiDisplay().onMouseDown.on(() => {
                    if (game && !finished.value) {
                        paused.value = !game.getGameTimer().isRunning();
                        if (paused.value) { music?.suspend(); effects?.stop(); }
                        else music?.play();
                    }
                });
                game.getGameTimer().speedFactor = speed.value;
                game.getGameTimer().onGameTick.on(updateStats);
                game.onGameEnd.on(result => {
                    if (!result || !game) return;
                    game.getGameTimer().suspend();
                    effects?.stop();
                    stopMusic();
                    playing.value = false;
                    paused.value = false;
                    finished.value = true;
                    resultMessage.value = result.state === GameStateTypes.SUCCEEDED
                        ? `Level complete! You saved ${result.survivorPercentage}%.`
                        : `Try again — you saved ${result.survivorPercentage}%.`;
                    if (result.state === GameStateTypes.SUCCEEDED) {
                        recordCompletion(gameType, groupIndex.value, levelIndex.value, result.survivorPercentage);
                    }
                });
                game.start();
                playing.value = true;
                paused.value = false;
                updateStats();
                if (musicEnabled.value) void playMusic();
            } catch (reason) {
                if (generation === loadGeneration) error.value = reason instanceof Error ? reason.message : 'Could not start this level.';
            } finally {
                if (generation === loadGeneration) loading.value = false;
            }
        }

        function togglePause() {
            if (!game || finished.value) return;
            game.getGameTimer().toggle();
            paused.value = !game.getGameTimer().isRunning();
            if (paused.value) { music?.suspend(); effects?.stop(); }
            else music?.play();
        }

        function openPauseMenu() {
            if (!game || paused.value || finished.value) return;
            togglePause();
            void nextTick(() => { if (paused.value) pauseHeading.value?.focus(); });
        }

        function resumeFromMenu() {
            if (!game || !paused.value || finished.value) return;
            togglePause();
            void nextTick(() => { if (!paused.value) pauseControl.value?.focus(); });
        }

        async function restartFromMenu() {
            const generation = loadGeneration + 1;
            await loadLevel();
            if (disposed || generation !== loadGeneration || !canPlay.value) return;
            await start();
            if (!disposed && playing.value) await nextTick(() => pauseControl.value?.focus());
        }

        function selectSkill(type: SkillTypes) {
            if (!game || finished.value) return;
            game.queueCommand(new CommandSelectSkill(type));
            updateStats();
        }

        function changeReleaseRate(delta: number) {
            if (!game || finished.value) return;
            game.queueCommand(delta > 0 ? new CommandReleaseRateIncrease(delta) : new CommandReleaseRateDecrease(-delta));
            updateStats();
        }

        function confirmNuke() {
            if (!game || finished.value) return;
            if (!nukeArmed.value) { nukeArmed.value = true; return; }
            game.queueCommand(new CommandNuke());
            nukeArmed.value = false;
        }

        function setSpeed(value: number) {
            speed.value = value;
            if (game) game.getGameTimer().speedFactor = value;
            saveSettings({ speed: value, musicEnabled: musicEnabled.value, soundEnabled: soundEnabled.value });
        }

        function onSpeedChange(event: Event) {
            setSpeed(Number((event.target as HTMLSelectElement).value));
        }

        async function playMusic() {
            if (!resources || !musicEnabled.value) return;
            stopMusic();
            const generation = musicGeneration;
            try {
                const player = await resources.getMusicPlayer(levelIndex.value % 20);
                if (disposed || !musicEnabled.value || generation !== musicGeneration) { player.stop(); return; }
                music = player;
                if (paused.value) music.suspend();
                else music.play();
            } catch {
                if (generation === musicGeneration) {
                    musicEnabled.value = false;
                    saveSettings({ speed: speed.value, musicEnabled: false, soundEnabled: soundEnabled.value });
                }
            }
        }

        function toggleMusic() {
            musicEnabled.value = !musicEnabled.value;
            saveSettings({ speed: speed.value, musicEnabled: musicEnabled.value, soundEnabled: soundEnabled.value });
            if (musicEnabled.value) void playMusic();
            else stopMusic();
        }

        function toggleSound() {
            soundEnabled.value = !soundEnabled.value;
            saveSettings({ speed: speed.value, musicEnabled: musicEnabled.value, soundEnabled: soundEnabled.value });
            if (!soundEnabled.value) effects?.stop();
        }

        function zoom(delta: number) { stage?.zoomGame(delta); }

        function onVisibilityChange() {
            if (document.hidden && game && game.getGameTimer().isRunning()) {
                game.getGameTimer().suspend();
                music?.suspend();
                effects?.stop();
                paused.value = true;
            }
        }

        function onKeyDown(event: KeyboardEvent) {
            if (event.defaultPrevented) return;
            if ((event.key === 'Escape' || event.key === 'BrowserBack') && paused.value && !fullscreenActive.value) {
                const target = event.target as HTMLElement | null;
                if (target?.tagName === 'SELECT') return;
                event.preventDefault();
                resumeFromMenu();
                return;
            }
            if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
            const target = event.target as HTMLElement | null;
            if (target?.isContentEditable || /^(A|INPUT|SELECT|TEXTAREA|BUTTON)$/.test(target?.tagName || '')) return;
            if (!game || finished.value) return;
            event.preventDefault();
            if (paused.value) resumeFromMenu();
            else openPauseMenu();
        }

        async function changeLevel(delta: number) {
            try {
                const config = await factory.getConfig(gameType);
                if (!config || disposed) return;
                let next = levelIndex.value + delta;
                let group = groupIndex.value;
                if (next >= config.level.getGroupLength(group)) { group++; next = 0; }
                if (next < 0) { group--; next = config.level.getGroupLength(group) - 1; }
                if (group < 0 || group >= config.level.order.length || next < 0) return;
                groupIndex.value = group;
                levelIndex.value = next;
                // Keep refresh/deep links on the level the player is actually viewing.
                void router.replace({ query: { ...route.query, group, level: next } }).catch(() => undefined);
                await loadLevel();
            } catch {
                if (!disposed) error.value = 'Could not change levels. Please try again.';
            }
        }

        onMounted(() => {
            if (!gameCanvas.value) return;
            stage = new Stage(gameCanvas.value);
            document.addEventListener('visibilitychange', onVisibilityChange);
            window.addEventListener('keydown', onKeyDown);
            void loadLevel();
        });
        onBeforeUnmount(() => {
            disposed = true;
            ++loadGeneration;
            disposeGame();
            stopMusic();
            stage?.dispose();
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('keydown', onKeyDown);
        });

        return { gamePage, gameCanvas, pauseControl, pauseHeading, fullscreenActive, fullscreenMode, toggleFullscreen,
            level, levelIndex, groupName, title, error, loading, playing, paused,
            finished, resultMessage, hints, visibleHintCount, nukeArmed, selectedSkill, skillCounts, releaseRate, gameTime, speed,
            musicEnabled, soundEnabled, skillButtons, canPlay, start, openPauseMenu, resumeFromMenu, restartFromMenu, selectSkill, changeReleaseRate,
            setSpeed, onSpeedChange, toggleMusic, toggleSound, zoom, changeLevel, loadLevel, confirmNuke };
    },
});
