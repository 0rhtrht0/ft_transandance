function onkeydown(event)
{
    const keys = { up: false, down: false, left: false, right: false };
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "z")
        keys.up = true;
    if (event.key === "ArrowDown" || event.key === "s")
        keys.down = true;
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "q")
        keys.left = true;
    if (event.key === "ArrowRight" || event.key === "d")
        keys.right = true;
}

window.addEventListener("keydown", (event) => {
    const movementkeys = [ "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "z", "q" ];
    if (movementkeys.includes(event.key))
        event.preventDefault
    handleKeyDown(event);
});


function update_player(player, time)
{
    const speed = 0.15;
    if (keys.up)
        player.y -= speed * time;
    if (keys.down)
        player.y += speed * time;
    if (keys.left)
        player.x -= speed * time;
    if (keys.right)
        player.x += speed * time;
}
 

function update_player_position(id, x, y)
{
    const player = players.find(player => player.id === id);
    if (player)
    {
        player.x = x;
        player.y = y;
        console.log(`Player ${player.name} moved to position (${x}, ${y}).`);
    }
    return (false);
}
