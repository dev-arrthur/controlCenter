(() => {
  const navbar = document.getElementById('navbar');
  const progress = document.getElementById('scrollProgress');
  const button = document.getElementById('menuButton');
  const menu = document.getElementById('mobileMenu');

  const onScroll = () => {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 20);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = max > 0 ? `${Math.min(100, (window.scrollY / max) * 100)}%` : '0%';
    }
  };

  const closeMenu = () => {
    if (!menu || !button) return;
    menu.classList.remove('active');
    document.body.classList.remove('menu-open');
    button.setAttribute('aria-expanded', 'false');
    const icon = button.querySelector('i');
    if (icon) icon.className = 'bi bi-list';
  };

  if (button && menu) {
    button.addEventListener('click', () => {
      const open = !menu.classList.contains('active');
      menu.classList.toggle('active', open);
      document.body.classList.toggle('menu-open', open);
      button.setAttribute('aria-expanded', String(open));
      const icon = button.querySelector('i');
      if (icon) icon.className = open ? 'bi bi-x-lg' : 'bi bi-list';
    });
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { if (window.innerWidth > 1200) closeMenu(); });
  onScroll();
})();
