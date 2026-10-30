import { computed, defineComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
import { readSettings, recordCompletion, rememberLevel, saveSettings } from '@/game/progress';
import { getTestedSolution } from '@/game/solutions/tested-solutions';
import { verifyHintData, type HintCompatibility } from '@/game/solutions/hint-compatibility';
import { getExampleFirstMove, type ExampleFirstMove } from '@/game/solutions/example-first-move';
import { Position2D } from '@/game/utilities/position2d';
import { Level } from '@/game/resources/level';
import { AudioPlayer } from '@/game/resources/sound/audio-player';
import { SoundEffectsPlayer } from '@/game/resources/sound/sound-effects-player';
import { VoiceEffectsPlayer } from '@/game/resources/sound/voice-effects-player';
import { WindowsMidiPlayer, WINDOWS_MIDI_TRACKS } from '@/game/resources/sound/windows-midi-player';
import { getWindowsAudioFile } from '@/game/resources/file/game-file-store';
import { readAudioStyle } from '@/game/audio-style';
import { Stage } from '@/game/view/stage';
import { KeyboardTargeting } from '@/game/view/keyboard-targeting';
import { assignPlayerSkill } from '@/game/view/player-assignment';
import { useGameFullscreen } from './use-game-fullscreen';
import { readGraphicsMode, saveGraphicsMode, type GraphicsMode } from './graphics-preference';
import './game-fullscreen.css';

const skillButtons = [
    { name: 'Climb', type: SkillTypes.CLIMBER }, { name: 'Float', type: SkillTypes.FLOATER },
    { name: 'Bomb', type: SkillTypes.BOMBER }, { name: 'Block', type: SkillTypes.BLOCKER },
    { name: 'Build', type: SkillTypes.BUILDER }, { name: 'Bash', type: SkillTypes.BASHER },
    { name: 'Mine', type: SkillTypes.MINER }, { name: 'Dig', type: SkillTypes.DIGGER },
];

function readLevelIndex(value: unknown): number {
    const index = Number(value);
    return Number.isSafeInteger(index) && index >= 0 ? index : 0;
}

export default defineComponent({
    setup() {
        const route = useRoute();
        const router = useRouter();
        const gameScreen = ref<HTMLElement | null>(null);
        const fullscreenEnterButton = ref<HTMLButtonElement | null>(null);
        const startControl = ref<HTMLButtonElement | null>(null);
        const pauseControl = ref<HTMLButtonElement | null>(null);
        const pauseHeading = ref<HTMLElement | null>(null);
        const gameCanvas = ref<HTMLCanvasElement | null>(null);
        const originalPreview = ref<HTMLCanvasElement | null>(null);
        const enhancedPreview = ref<HTMLCanvasElement | null>(null);
        const graphicsMode = ref<GraphicsMode>(readGraphicsMode());
        const comparingGraphics = ref(false);
        const graphicsError = ref('');
        const zoomChanged = ref(false);
        const { fullscreenActive, fullscreenMode, toggleFullscreen } = useGameFullscreen(gameScreen);
        const fullscreenControlsOpen = ref(false);
        // A HUD press changes pause/nuke state on pointerdown. Opening an
        // overlay under the same finger before the browser's click can cause
        // that click to activate a newly appeared control.
        const deferFullscreenControls = ref(false);
        let canvasGestureId: number | null = null;
        let canvasGesturePointerDown = false;
        let canvasGestureSequence = 0;
        let canvasGestureTimer: ReturnType<typeof setTimeout> | null = null;
        function clearCanvasGesture() {
            canvasGestureSequence++;
            if (canvasGestureTimer !== null) clearTimeout(canvasGestureTimer);
            canvasGestureTimer = null;
            canvasGestureId = null;
            canvasGesturePointerDown = false;
            deferFullscreenControls.value = false;
        }
        function scheduleCanvasGestureEnd(delay: number) {
            if (canvasGestureTimer !== null) clearTimeout(canvasGestureTimer);
            const sequence = canvasGestureSequence;
            canvasGestureTimer = setTimeout(() => {
                if (sequence === canvasGestureSequence) clearCanvasGesture();
            }, delay);
        }
        function beginCanvasGesture(event: PointerEvent) {
            if (!fullscreenActive.value || !playing.value || paused.value || fullscreenControlsOpen.value || canvasGesturePointerDown) return;
            clearCanvasGesture();
            canvasGestureId = event.pointerId;
            canvasGesturePointerDown = true;
            deferFullscreenControls.value = true;
        }
        function finishCanvasGesture(event: PointerEvent) {
            if (!deferFullscreenControls.value || event.pointerId !== canvasGestureId) return;
            canvasGesturePointerDown = false;
            // Some browsers suppress click after a cancelled gesture. Never
            // leave the menu inaccessible if no click arrives.
            scheduleCanvasGestureEnd(400);
        }
        function cancelCanvasGesture(event: PointerEvent) {
            if (!deferFullscreenControls.value || event.pointerId !== canvasGestureId) return;
            canvasGesturePointerDown = false;
            scheduleCanvasGestureEnd(0);
        }
        function loseCanvasCapture(event: PointerEvent) {
            if (!deferFullscreenControls.value || event.pointerId !== canvasGestureId) return;
            canvasGesturePointerDown = false;
            if (canvasGestureTimer === null) scheduleCanvasGestureEnd(400);
        }
        function finishCanvasGestureFromClick(event: MouseEvent) {
            if (!deferFullscreenControls.value || canvasGesturePointerDown) return;
            const pointerId = 'pointerId' in event ? (event as PointerEvent).pointerId : null;
            if (event.target === gameCanvas.value || (pointerId !== null && pointerId === canvasGestureId)) scheduleCanvasGestureEnd(0);
        }
        const level = ref<Level | null>(null);
        const levelIndex = ref(readLevelIndex(route.query.level));
        const groupIndex = ref(readLevelIndex(route.query.group));
        const groupName = ref('');
        const error = ref('');
        const loading = ref(true);
        const playing = ref(false);
        const paused = ref(false);
        const finished = ref(false);
        const levelSucceeded = ref(false);
        const nextLevelAvailable = ref(false);
        const savedCount = ref(0);
        const saveWarning = ref('');
        const assignmentMessage = ref('');
        const keyboardMessage = ref('');
        const resultMessage = ref('');
        const visibleHintCount = ref(0);
        const hintCompatibility = ref<HintCompatibility | 'checking'>('checking');
        const exampleMove = ref<ExampleFirstMove | null>(null);
        const exampleBusy = ref(false);
        const exampleError = ref('');
        const nukeArmed = ref(false);
        const nukeExecuted = ref(false);
        const selectedSkill = ref<SkillTypes>(SkillTypes.CLIMBER);
        const skillCounts = ref<Record<number, number>>({});
        const releaseRate = ref(0);
        const gameTime = ref('');
        const settings = readSettings();
        const speed = ref(settings.speed);
        watch([fullscreenActive, playing, paused, finished, nukeArmed, deferFullscreenControls], ([active, isPlaying, isPaused, isFinished, nuke, deferred]) => {
            fullscreenControlsOpen.value = active && !deferred && (!isPlaying || isPaused || isFinished || nuke);
        });
        watch(fullscreenControlsOpen, (open, wasOpen) => {
            if (open && fullscreenActive.value && paused.value) {
                void nextTick(focusPauseMenu);
            } else if (!open && wasOpen && fullscreenActive.value && playing.value && !paused.value) {
                void nextTick(() => gameCanvas.value?.focus());
            }
        });
        watch(fullscreenActive, active => {
            if (!active) clearCanvasGesture();
            void nextTick(() => {
                if (paused.value) focusPauseMenu();
                else (active ? playing.value ? gameCanvas.value : startControl.value : fullscreenEnterButton.value)?.focus();
            });
        });
        const musicEnabled = ref(settings.musicEnabled);
        const soundEnabled = ref(settings.soundEnabled);
        const gameType = ref((Number(route.params.gameType) || GameTypes.LEMMINGS) as GameTypes);
        const factory = new GameFactory(`${import.meta.env.BASE_URL}data`);
        let resources: GameResources | null = null;
        let game: Game | null = null;
        let stage: Stage | null = null;
        let keyboardTargeting: KeyboardTargeting | null = null;
        let music: Pick<AudioPlayer, 'play' | 'suspend' | 'stop'> | null = null;
        let effects: SoundEffectsPlayer | null = null;
        const windowsEffects = new VoiceEffectsPlayer(async name => {
            const data = await getWindowsAudioFile(name);
            return data ? new Uint8Array(data) : null;
        });
        let effectGeneration = 0;
        let disposed = false;
        let loadGeneration = 0;
        let musicGeneration = 0;
        let exampleGeneration = 0;

        const title = computed(() => level.value?.name || 'Loading level');
        const canPlay = computed(() => !!level.value && !loading.value && !error.value);
        const availableHints = computed(() => gameType.value === GameTypes.LEMMINGS
            ? getTestedSolution(groupIndex.value, levelIndex.value)?.hints ?? [] : []);
        const hints = computed(() => hintCompatibility.value === 'verified' ? availableHints.value : []);
        const exampleSkillName = computed(() => skillButtons.find(skill => skill.type === exampleMove.value?.skill)?.name || 'skill');
        const exampleClock = computed(() => {
            if (!exampleMove.value || !level.value) return '';
            const remaining = Math.max(0, level.value.timeLimit * 60 - exampleMove.value.gameSeconds);
            return `${Math.floor(remaining / 60)}-${String(remaining % 60).padStart(2, '0')}`;
        });

        function clearExample() {
            ++exampleGeneration;
            exampleMove.value = null;
            exampleBusy.value = false;
            exampleError.value = '';
            stage?.setExampleHint(null);
        }

        function hideHints() {
            visibleHintCount.value = 0;
            clearExample();
        }

        async function showExample() {
            if (!hints.value.length || !visibleHintCount.value || exampleBusy.value) return;
            const generation = ++exampleGeneration;
            const levelGeneration = loadGeneration;
            exampleBusy.value = true;
            exampleError.value = '';
            try {
                const move = await getExampleFirstMove(factory, groupIndex.value, levelIndex.value);
                if (disposed || generation !== exampleGeneration || levelGeneration !== loadGeneration) return;
                if (!move) { exampleError.value = 'No visual example is available for this level.'; return; }
                exampleMove.value = move;
                stage?.setExampleHint(new Position2D(move.x, move.y));
            } catch {
                if (!disposed && generation === exampleGeneration && levelGeneration === loadGeneration) exampleError.value = 'Could not show this example. Please try again.';
            } finally {
                if (generation === exampleGeneration) exampleBusy.value = false;
            }
        }

        function stopMusic() {
            musicGeneration++;
            music?.stop();
            music = null;
        }

        function suspendMusic() {
            // Invalidate an in-flight MIDI start without stopping a later
            // resume of the same player when that older request resolves.
            if (music instanceof WindowsMidiPlayer) musicGeneration++;
            music?.suspend();
        }

        function updateStats() {
            if (!game) return;
            const skills = game.getGameSkills();
            const counts: Record<number, number> = {};
            for (const skill of skillButtons) counts[skill.type] = skills.getSkill(skill.type);
            skillCounts.value = counts;
            selectedSkill.value = skills.getSelectedSkill();
            releaseRate.value = game.getVictoryCondition().getCurrentReleaseRate();
            savedCount.value = game.getVictoryCondition().getSurvivorsCount();
            gameTime.value = game.getGameTimer().getGameLeftTimeString();
        }

        function disposeGame() {
            keyboardTargeting?.reset();
            effectGeneration++;
            windowsEffects.stop();
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
            const requestedGame = gameType.value;
            const requestedGroup = groupIndex.value;
            const requestedLevel = levelIndex.value;
            disposeGame();
            stopMusic();
            resources = null;
            loading.value = true;
            error.value = '';
            finished.value = false;
            levelSucceeded.value = false;
            nukeArmed.value = false;
            nukeExecuted.value = false;
            assignmentMessage.value = '';
            savedCount.value = 0;
            resultMessage.value = '';
            hideHints();
            hintCompatibility.value = 'checking';
            try {
                const config = await factory.getConfig(requestedGame);
                if (!config) throw new Error('The selected game is not available.');
                const group = config.level.order[requestedGroup];
                if (!group || requestedLevel >= group.length) throw new Error('The selected level is not available.');
                const nextResources = await factory.getGameResources(requestedGame);
                if (!nextResources) throw new Error('Could not load the game files.');
                const nextLevel = await nextResources.getLevel(requestedGroup, requestedLevel);
                if (!nextLevel) throw new Error('Could not load this level.');
                if (disposed || generation !== loadGeneration) return;
                resources = nextResources;
                groupName.value = config.level.groups[requestedGroup] || `Group ${requestedGroup + 1}`;
                level.value = nextLevel;
                nextLevelAvailable.value = levelIndex.value + 1 < group.length || groupIndex.value + 1 < config.level.order.length;
                noteSaveResult(rememberLevel(requestedGame, requestedGroup, requestedLevel));
                if (requestedGame === GameTypes.LEMMINGS) {
                    void verifyHintData().then(result => {
                        if (!disposed && generation === loadGeneration) hintCompatibility.value = result;
                    }).catch(() => {
                        if (!disposed && generation === loadGeneration) hintCompatibility.value = 'unavailable';
                    });
                }
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
            if (soundEnabled.value && readAudioStyle() === 'windows') windowsEffects.prime();
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
                const nextGame = await factory.getGame(gameType.value, groupIndex.value, levelIndex.value);
                if (!nextGame) throw new Error('Could not start this level.');
                if (disposed || generation !== loadGeneration || !stage) {
                    nextGame.stop();
                    return;
                }
                game = nextGame;
                const skills = game.getGameSkills();
                if (skills.getSkill(skills.getSelectedSkill()) <= 0) {
                    const firstAvailable = skillButtons.find(skill => skills.getSkill(skill.type) > 0);
                    if (firstAvailable) game.queueCommand(new CommandSelectSkill(firstAvailable.type));
                }
                game.setNukeRequestHandler(confirmNuke);
                game.onPlayerAssignment.on(result => {
                    switch (result) {
                        case 'miss': assignmentMessage.value = 'No lemming found there. Tap closer to a lemming.'; break;
                        case 'unavailable': assignmentMessage.value = 'No uses of this skill remain. Choose another skill.'; break;
                        case 'rejected': assignmentMessage.value = 'That lemming cannot use this skill right now.'; break;
                        case 'assigned': assignmentMessage.value = ''; updateStats(); break;
                    }
                });
                const activeResources = resources;
                effects = activeResources ? new SoundEffectsPlayer(index => activeResources.getSoundTrack(index)) : null;
                game.onSoundEffect.on(effect => {
                    if (effect === undefined || !soundEnabled.value || !playing.value || paused.value) return;
                    const generation = ++effectGeneration;
                    if (readAudioStyle() !== 'windows') { windowsEffects.cancel(); void effects?.play(effect); return; }
                    effects?.stop();
                    windowsEffects.cancel();
                    void windowsEffects.play(effect).then(played => {
                        if (!played && generation === effectGeneration && soundEnabled.value && playing.value && !paused.value) void effects?.play(effect);
                    });
                });
                stage.clearInputBindings();
                game.setGameDisplay(stage.getGameDisplay());
                game.setGuiDisplay(stage.getGuiDisplay());
                stage.getGuiDisplay().onMouseDown.on(() => {
                    if (game && !finished.value) {
                        const wasPaused = paused.value;
                        paused.value = !game.getGameTimer().isRunning();
                        if (paused.value !== wasPaused) {
                            if (paused.value) {
                                suspendMusic(); stopEffects();
                                void nextTick(focusPauseMenu);
                            } else resumeMusic();
                        }
                    }
                });
                game.getGameTimer().speedFactor = speed.value;
                game.getGameTimer().onGameTick.on(updateStats);
                game.onGameEnd.on(result => {
                    if (!result || !game) return;
                    game.getGameTimer().suspend();
                    stopEffects();
                    stopMusic();
                    playing.value = false;
                    paused.value = false;
                    finished.value = true;
                    nukeArmed.value = false;
                    levelSucceeded.value = result.state === GameStateTypes.SUCCEEDED;
                    resultMessage.value = result.state === GameStateTypes.SUCCEEDED
                        ? `Level complete! You saved ${result.survivorPercentage}%.`
                        : `Try again — you saved ${result.survivorPercentage}%.`;
                    if (result.state === GameStateTypes.SUCCEEDED) {
                        noteSaveResult(recordCompletion(gameType.value, groupIndex.value, levelIndex.value, result.survivorPercentage));
                    }
                });
                game.start();
                playing.value = true;
                paused.value = false;
                // Loading can finish after the player switches tabs or locks
                // the phone. Apply the same pause policy as a running game.
                onVisibilityChange();
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
            if (paused.value) { suspendMusic(); stopEffects(); }
            else resumeMusic();
        }

        function focusPauseMenu() {
            const heading = pauseHeading.value;
            if (disposed || !paused.value || !heading?.isConnected ||
                (fullscreenActive.value && !fullscreenControlsOpen.value)) return;
            heading.focus({ preventScroll: true });
            // The heading can fit while Resume is below the viewport. Reveal
            // the whole menu without moving focus or animating the page.
            heading.closest<HTMLElement>('.pause-menu')?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
        }

        function openPauseMenu() {
            if (!game || paused.value || finished.value) return;
            togglePause();
            void nextTick(focusPauseMenu);
        }

        function resumeFromMenu() {
            if (!game || !paused.value || finished.value) return;
            togglePause();
            void nextTick(() => { if (!paused.value) (fullscreenActive.value ? gameCanvas.value : pauseControl.value)?.focus(); });
        }

        async function restartFromMenu() {
            const generation = loadGeneration + 1;
            await loadLevel();
            if (disposed || generation !== loadGeneration || !canPlay.value) return;
            await start();
            if (!disposed && playing.value) await nextTick(() => (fullscreenActive.value ? gameCanvas.value : pauseControl.value)?.focus());
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
            if (!game || finished.value || nukeExecuted.value) return;
            if (!nukeArmed.value) { nukeArmed.value = true; return; }
            nukeExecuted.value = game.queueCommand(new CommandNuke());
            nukeArmed.value = false;
        }

        function noteSaveResult(saved: boolean) {
            if (!saved) saveWarning.value = 'Progress or preferences could not be saved on this device.';
        }

        function setGraphicsMode(mode: GraphicsMode) {
            graphicsMode.value = mode;
            graphicsError.value = '';
            noteSaveResult(saveGraphicsMode(mode));
            stage?.setGraphicsMode(mode);
        }

        function onGraphicsError(message?: string) {
            graphicsMode.value = 'original';
            graphicsError.value = message || 'Enhanced graphics are unavailable. Original graphics have been restored.';
            noteSaveResult(saveGraphicsMode('original'));
            // Stage has already disconnected failed previews before emitting this event.
            comparingGraphics.value = false;
        }

        async function toggleGraphicsComparison() {
            comparingGraphics.value = !comparingGraphics.value;
            if (!comparingGraphics.value) {
                stage?.setComparisonCanvases(null, null);
                return;
            }
            await nextTick();
            if (!disposed && comparingGraphics.value) stage?.setComparisonCanvases(originalPreview.value, enhancedPreview.value);
        }

        function onDisplaySettingsToggle(event: Event) {
            if (!(event.target as HTMLDetailsElement).open && comparingGraphics.value) void toggleGraphicsComparison();
        }

        function setSpeed(value: number) {
            speed.value = value;
            if (game) game.getGameTimer().speedFactor = value;
            noteSaveResult(saveSettings({ speed: value, musicEnabled: musicEnabled.value, soundEnabled: soundEnabled.value }));
        }

        function onSpeedChange(event: Event) {
            setSpeed(Number((event.target as HTMLSelectElement).value));
        }

        async function playMusic() {
            if (!resources || !musicEnabled.value) return;
            stopMusic();
            const generation = musicGeneration;
            try {
                if (readAudioStyle() === 'windows') {
                    const name = WINDOWS_MIDI_TRACKS[levelIndex.value % WINDOWS_MIDI_TRACKS.length];
                    const player = new WindowsMidiPlayer(async () => (await getWindowsAudioFile(name)) ?? null);
                    player.prime();
                    // Make pending playback visible to mute, pause and teardown
                    // before loading or decoding has a chance to finish.
                    music = player;
                    const played = await player.play();
                    if (disposed || !musicEnabled.value || generation !== musicGeneration) {
                        if (music !== player) player.stop();
                        return;
                    }
                    if (paused.value || document.hidden) { player.suspend(); return; }
                    if (played) {
                        return;
                    }
                    player.stop();
                    music = null;
                }
                const player = await resources.getMusicPlayer(levelIndex.value % 20);
                if (disposed || !musicEnabled.value || generation !== musicGeneration) { player.stop(); return; }
                music = player;
                if (paused.value || document.hidden) music.suspend();
                else music.play();
            } catch {
                if (generation === musicGeneration) {
                    musicEnabled.value = false;
                    noteSaveResult(saveSettings({ speed: speed.value, musicEnabled: false, soundEnabled: soundEnabled.value }));
                }
            }
        }

        function resumeMusic() {
            const current = music;
            if (!(current instanceof WindowsMidiPlayer)) { current?.play(); return; }
            const generation = musicGeneration;
            void current.play().then(async played => {
                if (played || disposed || !musicEnabled.value || paused.value || document.hidden ||
                    generation !== musicGeneration || music !== current || !resources) return;
                current.stop();
                music = null;
                try {
                    const fallback = await resources.getMusicPlayer(levelIndex.value % 20);
                    if (disposed || !musicEnabled.value || generation !== musicGeneration) { fallback.stop(); return; }
                    music = fallback;
                    if (paused.value || document.hidden) fallback.suspend();
                    else fallback.play();
                } catch {
                    if (generation === musicGeneration) {
                        musicEnabled.value = false;
                        noteSaveResult(saveSettings({ speed: speed.value, musicEnabled: false, soundEnabled: soundEnabled.value }));
                    }
                }
            });
        }

        function toggleMusic() {
            musicEnabled.value = !musicEnabled.value;
            noteSaveResult(saveSettings({ speed: speed.value, musicEnabled: musicEnabled.value, soundEnabled: soundEnabled.value }));
            if (musicEnabled.value) void playMusic();
            else stopMusic();
        }

        function toggleSound() {
            soundEnabled.value = !soundEnabled.value;
            noteSaveResult(saveSettings({ speed: speed.value, musicEnabled: musicEnabled.value, soundEnabled: soundEnabled.value }));
            if (!soundEnabled.value) stopEffects();
            else if (readAudioStyle() === 'windows') windowsEffects.prime();
        }

        function stopEffects() {
            effectGeneration++;
            windowsEffects.cancel();
            effects?.stop();
        }

        function zoom(delta: number) { stage?.zoomGame(delta); }
        function resetZoom() { stage?.resetZoom(); }
        function onZoomChange(changed?: boolean) { zoomChanged.value = !!changed; }

        function onVisibilityChange() {
            if (document.hidden) {
                suspendMusic();
                stopEffects();
                if (game && game.getGameTimer().isRunning()) {
                    game.getGameTimer().suspend();
                    paused.value = true;
                }
            } else if (!playing.value && musicEnabled.value) {
                // The music toggle also previews the soundtrack before play.
                // Resume that preview, but leave a backgrounded game paused.
                resumeMusic();
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
            if (target?.isContentEditable || target?.closest('[data-game-shortcuts-ignore]') || /^(A|INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY)$/.test(target?.tagName || '')) return;
            if (!game || finished.value) return;
            event.preventDefault();
            if (paused.value) resumeFromMenu();
            else openPauseMenu();
        }

        async function changeLevel(delta: number) {
            try {
                const config = await factory.getConfig(gameType.value);
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

        // Vue Router reuses this component between game URLs. Keep external
        // navigation (including history) in sync without reloading for the
        // query update produced by our own Previous/Next controls.
        watch(() => [route.params.gameType, route.query.group, route.query.level], () => {
            const nextGame = (Number(route.params.gameType) || GameTypes.LEMMINGS) as GameTypes;
            const nextGroup = readLevelIndex(route.query.group);
            const nextLevel = readLevelIndex(route.query.level);
            if (nextGame === gameType.value && nextGroup === groupIndex.value && nextLevel === levelIndex.value) return;
            gameType.value = nextGame;
            groupIndex.value = nextGroup;
            levelIndex.value = nextLevel;
            if (stage) void loadLevel();
        });

        onMounted(() => {
            if (!gameCanvas.value) return;
            stage = new Stage(gameCanvas.value);
            stage.onGraphicsError.on(onGraphicsError);
            stage.onZoomChange.on(onZoomChange);
            stage.setGraphicsMode(graphicsMode.value);
            keyboardTargeting = new KeyboardTargeting(gameCanvas.value, stage, () => game, assignPlayerSkill, message => { keyboardMessage.value = message; });
            document.addEventListener('visibilitychange', onVisibilityChange);
            window.addEventListener('keydown', onKeyDown);
            void loadLevel();
        });
        onBeforeUnmount(() => {
            disposed = true;
            clearCanvasGesture();
            ++loadGeneration;
            clearExample();
            disposeGame();
            stopMusic();
            stage?.setComparisonCanvases(null, null);
            stage?.onGraphicsError.off(onGraphicsError);
            stage?.onZoomChange.off(onZoomChange);
            keyboardTargeting?.dispose();
            stage?.dispose();
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('keydown', onKeyDown);
        });

        return { gameScreen, fullscreenEnterButton, startControl, gameCanvas, beginCanvasGesture, finishCanvasGesture, cancelCanvasGesture, loseCanvasCapture, finishCanvasGestureFromClick, originalPreview, enhancedPreview, graphicsMode, comparingGraphics, graphicsError, setGraphicsMode, toggleGraphicsComparison, onDisplaySettingsToggle, pauseControl, pauseHeading, fullscreenActive, fullscreenControlsOpen, fullscreenMode, toggleFullscreen,
            level, levelIndex, groupName, title, error, loading, playing, paused,
            finished, levelSucceeded, nextLevelAvailable, savedCount, saveWarning, assignmentMessage, keyboardMessage, resultMessage, hints, availableHints, hintCompatibility, visibleHintCount, exampleMove, exampleBusy, exampleError, exampleSkillName, exampleClock, hideHints, showExample, clearExample, nukeArmed, nukeExecuted, selectedSkill, skillCounts, releaseRate, gameTime, speed,
            musicEnabled, soundEnabled, skillButtons, canPlay, start, openPauseMenu, resumeFromMenu, restartFromMenu, selectSkill, changeReleaseRate,
            setSpeed, onSpeedChange, toggleMusic, toggleSound, zoom, zoomChanged, resetZoom, changeLevel, loadLevel, confirmNuke };
    },
});
