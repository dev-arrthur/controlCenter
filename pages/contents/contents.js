(() => {
  const filterButtons = [...document.querySelectorAll('.filter-btn')];
  const cards = [...document.querySelectorAll('.post-card')];
  const searchInput = document.getElementById('contentSearch');
  const count = document.getElementById('libraryCount');
  const topicButtons = [...document.querySelectorAll('[data-topic-filter]')];

  let currentFilter = 'todos';
  let currentQuery = '';

  const normalize = value => (value || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const render = () => {
    let visible = 0;
    const q = normalize(currentQuery.trim());

    cards.forEach(card => {
      const category = card.dataset.category || '';
      const haystack = normalize(`${card.dataset.search || ''} ${card.textContent || ''}`);
      const filterMatch = currentFilter === 'todos' || category === currentFilter;
      const queryMatch = !q || haystack.includes(q);
      const show = filterMatch && queryMatch;

      card.classList.toggle('hidden', !show);
      if (show) visible += 1;
    });

    if (count) count.textContent = `${visible} conteúdo${visible === 1 ? '' : 's'}`;
  };

  const setFilter = filter => {
    currentFilter = filter;
    filterButtons.forEach(button => button.classList.toggle('active', button.dataset.filter === filter));
    render();
    document.getElementById('biblioteca')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  filterButtons.forEach(button => {
    button.addEventListener('click', () => setFilter(button.dataset.filter || 'todos'));
  });

  topicButtons.forEach(button => {
    button.addEventListener('click', () => setFilter(button.dataset.topicFilter || 'todos'));
  });

  searchInput?.addEventListener('input', event => {
    currentQuery = event.target.value;
    render();
  });

  document.getElementById('contentSearchForm')?.addEventListener('submit', event => {
    event.preventDefault();
    render();
    document.getElementById('biblioteca')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  render();
})();
