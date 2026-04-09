import game from '../../game';
import gamescene from '../../scenes/gamescene';

const game = new.game();
const scene = new gamescene();

game.setScene(scene);
game.start();

export default class game {
    constructor()
    {
        this.canvas = document.querySelector("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.scene = null;
    }
    setScene(scene)
    {
        this.scene = scene;
    }
    start()
    {
        const loop = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.scene.update();
            this.scene.draw(this.ctx);
            requestAnimationFrame(loop);
        }
        loop();
    }
}

import maze from '../../maze';
import player from '../../player';

export default class gamescene {
    constructor(game)
    {
        this.game = game;
        this.maze = new maze();
        this.player = new player();
    }
    update()
    {
        this.player.update(this.maze);
    }
    draw (ctx)
    {
        this.maze.draw(ctx);
        this.player.draw(ctx);
    }
}