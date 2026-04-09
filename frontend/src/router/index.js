import {
    createRouter,
    createWebHistory,
    isNavigationFailure,
    NavigationFailureType
} from "vue-router";
import IntroView from "../views/IntroView.vue";
import AuthView from "../views/AuthView.vue";
import MenuView from "../views/MenuView.vue";
import IngameView from "../views/IngameView.vue";
import MazeView from "../views/MazeView.vue";
import GameoverView from "../views/GameoverView.vue";
import VictoryView from "../views/VictoryView.vue";
import FriendsView from "../views/FriendsView.vue";
import DifficultyView from "../views/DifficultyView.vue";
import LevelsView from "../views/LevelsView.vue";
import FileManagerView from "../views/FileManagerView.vue";
import PrivacyView from "../views/PrivacyView.vue";
import TermsView from "../views/TermsView.vue";

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: "/", name: "intro", component: IntroView, meta: { title: "Intro" } },
        { path: "/auth", name: "auth", component: AuthView, meta: { title: "Authentication" } },
        { path: "/menu", name: "menu", component: MenuView, meta: { title: "Main Menu" } },
        { path: "/difficulty", name: "difficulty", component: DifficultyView, meta: { title: "Difficulty Selection" } },
        { path: "/levels", name: "levels", component: LevelsView, meta: { title: "Levels" } },
        { path: "/ingame", name: "ingame", component: IngameView, meta: { title: "In Game" } },
        { path: "/maze", name: "maze", component: MazeView, meta: { title: "Maze" } },
        { path: "/gameover", name: "gameover", component: GameoverView, meta: { title: "Game Over" } },
        { path: "/victory", name: "victory", component: VictoryView, meta: { title: "Victory" } },
        { path: "/friends", name: "friends", component: FriendsView, meta: { title: "Social" } },
        { path: "/files", name: "files", component: FileManagerView, meta: { title: "File Locker" } },
        { path: "/privacy", name: "privacy", component: PrivacyView, meta: { title: "Privacy Policy" } },
        { path: "/terms", name: "terms", component: TermsView, meta: { title: "Terms of Service" } }
    ],
});

function patchNavigationMethod(methodName) {
    const originalMethod = router[methodName].bind(router);

    router[methodName] = async (...args) => {
        try {
            const result = await originalMethod(...args);
            if (isNavigationFailure(result, NavigationFailureType.duplicated)) {
                return router.currentRoute.value;
            }
            return result;
        } catch (error) {
            if (isNavigationFailure(error, NavigationFailureType.duplicated)) {
                return router.currentRoute.value;
            }
            throw error;
        }
    };
}

patchNavigationMethod("push");
patchNavigationMethod("replace");

router.afterEach((to) => {
    const title = String(to.meta?.title || to.name || "Blackhole").trim();
    document.title = `${title} | Blackhole`;
});

export default router;
