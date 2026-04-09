import router from "../../router/index.js";

export function goTo(route) {
    if (!route) {
        return Promise.resolve(false);
    }

    return router
        .push({ name: route })
        .then(() => true)
        .catch((error) => {
            console.error(`Route "${route}" not found or navigation failed.`, error);
            return false;
        });
}
