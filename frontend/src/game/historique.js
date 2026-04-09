window.history.pushState({ page: "game" }, "Game", "/game");
window.addEventListener("popstate",  function(event)
{
    if (event.state && event.state.page === "game")
    {
        console.log("You are back to the game page.", event.state.page);
    }
});

window.history.replaceState({ page: "game" }, "Game", "/game");