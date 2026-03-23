const GAME_VERSION = "v0.2.0";

globalThis.NOTICE_AVOID_VERSION = GAME_VERSION;

document.querySelectorAll("[data-game-version]").forEach((node) => {
  node.textContent = GAME_VERSION;
});
