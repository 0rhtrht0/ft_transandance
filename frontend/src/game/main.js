
const players = [];
const exit = { x: 10, y: 10 };
let game_over = false;
let winner = null;

function addPlayer(id, name, x=0, y=0)
{
    if (players.some (player => player.id === id))
    {
        console.warn(`Player with ID ${id} already exists.`);
        return null;
    }
    const player = { id: id, name: name, x: x, y: y };
    players.push(player);
    console.log(`Player ${name} has joined the game.`);
    return (player);
}

function removePlayer(id)
{
    const index = players.findIndex(player => player.id === id);
    if (!players)
        return;
    if (index !== -1)
    {
        players.splice(index, 1);
        console.log(`Player with ID ${id} has left the game.`);
    }
}



function boucle_de_jeu(snapshot)
{
    if (game_over || (snapshot && snapshot.game_ended))
        return;
    for (let i = 0; i < players.length; i++)
    {
        if (detection_victoire(players[i], exit))
        {
            game_over = true;
            winner = players[i];
            announce_victory(winner);
            break;
        }
    }
}


function find_player_id(id)
{
    return (players.find(player => player.id === id));
}

function get_winner()
{
    return (winner);
}





