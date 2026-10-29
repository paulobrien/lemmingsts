import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../../src/game/game';
import { assignPlayerSkill } from '../../src/game/view/player-assignment';

describe('live player assignment feedback', () => {
    it('distinguishes missed targets, empty skills, rejected actions and success', () => {
        const trigger = vi.fn(), queueCommand = vi.fn(() => false);
        let available = false;
        const game = {
            onPlayerAssignment: { trigger }, queueCommand,
            getGameSkills: () => ({ getSelectedSkill: () => 5, canDecreaseSkill: () => available }),
        } as unknown as Game;
        expect(assignPlayerSkill(game, null)).toBe('miss');
        expect(assignPlayerSkill(game, 4)).toBe('unavailable');
        expect(queueCommand).not.toHaveBeenCalled();
        available = true;
        expect(assignPlayerSkill(game, 4)).toBe('rejected');
        queueCommand.mockReturnValue(true);
        expect(assignPlayerSkill(game, 4)).toBe('assigned');
        expect(trigger.mock.calls).toEqual([['miss'], ['unavailable'], ['rejected'], ['assigned']]);
    });
});
