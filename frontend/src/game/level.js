let level = "easy";
if (level === "easy")
{
    console.log("You have selected the easy level.");
}
else if (level === "medium")
{
    console.log("You have selected the medium level.");
}
else if (level === "hard")
{
    console.log("You have selected the hard level.");
}
else
{
    console.log("Invalid level selected.");
}

function detection_victoire (player, exit)
{
    return (player.x === exit.x && player.y === exit.y);
}

function announce_victory(player)
{
    console.log(`Congratulations ${player.name}, you have won the game!`);
}