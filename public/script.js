// Dynamic data from backend
let trending = [];
let movies = [];
let series = [];

// DOM references
const trendingRow = document.getElementById('trendingRow');
const moviesGrid = document.getElementById('moviesGrid');
const seriesGrid = document.getElementById('seriesGrid');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('detailsModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModal = document.getElementById('closeModal');
const closeModalBottom = document.getElementById('closeModalBottom');
const modalHero = document.getElementById('modalHero');
const modalTitle = document.getElementById('modalTitle');
const modalMeta = document.getElementById('modalMeta');
const modalDescription = document.getElementById('modalDescription');
const modalTrailer = document.getElementById('modalTrailer');
const heroPlayBtn = document.getElementById('heroPlayBtn');
const heroInfoBtn = document.getElementById('heroInfoBtn');

// Scream 7 hero data
const scream7 = {
  title: "Scream 7",
  year: "2026",
  meta: "Movie",
  description:
    "When a new Ghostface killer emerges in the quiet town where Sidney Prescott has built a new life, her darkest fears are realized as her daughter becomes the next target. Determined to protect her family, Sidney must face the horrors of her past to put an end to the bloodshed once and for all.",
  image: "https://i.ytimg.com/vi/XK124pYbwsA/maxresdefault.jpg",
  imdb: "tt27047903"
};

// Lock hero buttons to Scream 7
heroPlayBtn.onclick = () => window.location.href = `/watch?imdb=${scream7.imdb}`;
heroInfoBtn.onclick = () => openModal(scream7);

// Create a card
function createCard(item) {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <img class="card-poster" src="${item.image}" alt="${item.title}" />
    <div class="card-body">
      <h3 class="card-title">${item.title}</h3>
      <p class="card-subtitle">${item.year} • ${item.meta}</p>
    </div>
  `;
  card.addEventListener('click', () => openModal(item));
  return card;
}

// Render a section
function renderSection(items, container, filterText = '') {
  container.innerHTML = '';
  const filtered = items.filter((item) => {
    const haystack = `${item.title} ${item.year} ${item.meta} ${item.description}`.toLowerCase();
    return haystack.includes(filterText.toLowerCase());
  });
  filtered.forEach((item) => container.appendChild(createCard(item)));
}

// Open modal
function openModal(item) {
  modalHero.style.backgroundImage =
    `linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.7)), url('${item.image}')`;
  modalTitle.textContent = item.title;
  modalMeta.textContent = `${item.year} • ${item.meta}`;
  modalDescription.textContent = item.description;
  modalTrailer.href = `/watch?imdb=${item.imdb}`;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// Close modal
function hideModal() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// Refresh all sections
function refreshAll(filterText = '') {
  renderSection(trending, trendingRow, filterText);
  renderSection(movies, moviesGrid, filterText);
  renderSection(series, seriesGrid, filterText);
}

// Load real data from backend
async function loadData() {
  trending = await fetch("/api/trending/movies").then(r => r.json());
  series = await fetch("/api/trending/tv").then(r => r.json());
  movies = trending;
  refreshAll();
}

// Search TMDB
async function searchTMDB(query) {
  if (!query.trim()) {
    refreshAll();
    return;
  }
  const results = await fetch(`/api/search?q=${query}`).then(r => r.json());
  renderSection(results, trendingRow);
  renderSection(results, moviesGrid);
  renderSection(results, seriesGrid);
}

// Event listeners
searchInput.addEventListener('input', (e) => searchTMDB(e.target.value));
modalBackdrop.addEventListener('click', hideModal);
closeModal.addEventListener('click', hideModal);
closeModalBottom.addEventListener('click', hideModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideModal();
});

// Load everything
loadData();