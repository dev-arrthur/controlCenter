(() => {
  const tabs = [...document.querySelectorAll('.case-tab')];
  const panels = [...document.querySelectorAll('.case-panel')];

  const activateCase = (id, updateHash = true) => {
    const tab = tabs.find(item => item.dataset.case === id);
    const panel = panels.find(item => item.dataset.panel === id);
    if (!tab || !panel) return;

    tabs.forEach(item => item.classList.toggle('active', item === tab));
    panels.forEach(item => item.classList.toggle('active', item === panel));

    if (updateHash) history.replaceState(null, '', `#${id}`);
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activateCase(tab.dataset.case));
  });

  document.querySelectorAll('.orbit-logo').forEach(link => {
    link.addEventListener('click', event => {
      const id = link.getAttribute('href')?.replace('#', '');
      if (!id) return;
      event.preventDefault();
      activateCase(id);
      document.getElementById('cases')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const hash = window.location.hash.replace('#', '');
  if (hash && tabs.some(tab => tab.dataset.case === hash)) activateCase(hash, false);

  const cards = [...document.querySelectorAll('.voice-card')];
  const prev = document.getElementById('prevVoice');
  const next = document.getElementById('nextVoice');
  let voiceIndex = 0;

  const renderVoice = () => {
    cards.forEach((card, index) => card.classList.toggle('active', index === voiceIndex));
  };

  prev?.addEventListener('click', () => {
    voiceIndex = (voiceIndex - 1 + cards.length) % cards.length;
    renderVoice();
  });

  next?.addEventListener('click', () => {
    voiceIndex = (voiceIndex + 1) % cards.length;
    renderVoice();
  });
})();
