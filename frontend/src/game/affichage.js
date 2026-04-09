document.querySelectorAll('nav a').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    const page = this.dataset.page;
    fetch(`${page}.html`)
      .then(response => response.text())
      .then(data => {
        document.getElementById('content-area').innerHTML = data;
      });
  });
});
