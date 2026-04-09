import { createRng } from "./frontend/src/routes/ingame/utils/rng.js";
const rng = createRng("moyen:42");
console.log(rng());
console.log(rng());
console.log(rng());
