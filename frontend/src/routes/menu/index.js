document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname.split("/").pop();
    const pseudo = localStorage.getItem('playerName') || 'Player';
    if (!pseudo && page !== "auth.html") 
        window.location.href = "auth.html";
});