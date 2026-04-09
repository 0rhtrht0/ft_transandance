const pseudo = localStorage.getItem('playerName');
const playerName = document.getElementById('player-name');
const backBtn = document.getElementById('back-menu-btn');
const evaluationPointsElement = document.getElementById('evaluation-points');
const levelElement = document.getElementById('level');
const badgeElement = document.getElementById('player-badge');

if (!pseudo)
    window.location.href = "auth.html";
else 
    if (playerName) {
        playerName.textContent = pseudo;
    }

if (backBtn) {
    backBtn.addEventListener('click', () => {
        window.location.href = "menu.html";
    });
}

let evaluationPoints = 0;
let level = 1;
let speed = 1000;

function startGameLoop() {
    setInterval(() => {
        evaluationPoints++;
        if (evaluationPointsElement) {
            evaluationPointsElement.textContent = evaluationPoints;
        }
        if (evaluationPoints % 10 === 0)
        {
            level++;
            if (levelElement) {
                levelElement.textContent = level;
            }
            updateDifficulty();
        }
    }, speed);
}

function updateDifficulty()
{
    if (speed > 300)
        speed -= 100;
    if (!badgeElement) {
        return;
    }
    if (level >= 10)
        badgeElement.textContent = "Expert";
    else if (level >= 5)
        badgeElement.textContent = "Intermediate";
    else
        badgeElement.textContent = "Novice";
}

startGameLoop();
