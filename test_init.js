import { init_maze } from "./frontend/src/routes/ingame/ingame.js";
try {
  init_maze();
} catch (e) {
  console.error(e);
}
