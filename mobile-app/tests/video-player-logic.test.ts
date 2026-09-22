import assert from "node:assert/strict"
import test from "node:test"
import type { Episode } from "../lib/api/contracts.ts"
import {
  applySwipeResistance,
  computeSwipeThreshold,
  resolveEpisodeSelection,
  resolveEpisodeSelectionChange,
  resolveEpisodeTabIndex,
  resolveSwipeDecision,
} from "../components/video-player/helpers.ts"

const episodes: Episode[] = [
  { episodeNo: 1, videoUrl: "one.mp4", duration: 10 },
  { episodeNo: 3, videoUrl: "three.mp4", duration: 10 },
  { episodeNo: 8, videoUrl: "eight.mp4", duration: 10 },
]

test("episode selection preserves sparse episode behavior", () => {
  assert.equal(resolveEpisodeSelection(episodes, 3), 3)
  assert.equal(resolveEpisodeSelection(episodes, 2), 1)
  assert.equal(resolveEpisodeSelection(episodes, 99), 8)
  assert.equal(resolveEpisodeSelection([], 7), 7)
  assert.equal(resolveEpisodeSelectionChange(3, 3), null)
  assert.equal(resolveEpisodeSelectionChange(3, 8), 8)
  assert.equal(resolveEpisodeTabIndex(31), 1)
})

test("gesture thresholds and resistance preserve player constants", () => {
  assert.equal(computeSwipeThreshold(400), 64)
  assert.equal(computeSwipeThreshold(800), 80)
  assert.equal(computeSwipeThreshold(1200), 96)
  assert.equal(applySwipeResistance(100), 72)
})

test("swipes select real adjacent episode numbers only", () => {
  assert.deepEqual(resolveSwipeDecision({ distance: 80, containerHeight: 640, nextEpisodeNo: 8 }), {
    type: "episode",
    episodeNo: 8,
  })
  assert.deepEqual(resolveSwipeDecision({ distance: -80, containerHeight: 640, previousEpisodeNo: 3 }), {
    type: "episode",
    episodeNo: 3,
  })
  assert.deepEqual(resolveSwipeDecision({ distance: 63, containerHeight: 640, nextEpisodeNo: 8 }), { type: "reset" })
  assert.deepEqual(resolveSwipeDecision({ distance: 80, containerHeight: 640 }), { type: "reset" })
})
