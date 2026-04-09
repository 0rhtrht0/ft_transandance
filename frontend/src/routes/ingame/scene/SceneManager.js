export default class SceneManager {
    constructor(game)
    {
        this.game = game;
        this.scenes = {};
        this.currentScene = null;
    }
    addScene(name, scene)
    {
        this.scenes[name] = scene;
    }
    setScene(name)
    {
        if (this.currentScene && this.currentScene.onExit)
            this.currentScene.onExit();
        this.currentScene = this.scenes[name];
        if (this.currentScene && this.currentScene.onEnter)
            this.currentScene.onEnter();
    }
    update(delta)
    {
        if (this.currentScene)
            this.currentScene.update(delta);
    }
    render(ctx)
    {
        if (this.currentScene)
            this.currentScene.render(ctx);
    }
}