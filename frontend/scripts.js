
document.addEventListener("DOMContentLoaded", () => {
    const button_play = document.getElementById("btn-play");
    const canvas = document.getElementById("game");
    console.log(button_play, canvas);
    button_play.addEventListener("click", () => {
        console.log("Play button clicked!");    
        canvas.style.display = "block";
        button_play.style.display = "none";
    });
});

const title = document.getElementById("title");
const button = document.getElementById("btn-play");

button.addEventListener("click", function() {
    console.log("Play button clicked!");
    title.textContent = "Let's Play!";
});