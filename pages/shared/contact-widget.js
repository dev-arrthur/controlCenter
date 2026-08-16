(() => {
  const root = document.getElementById('contactFloating');
  const trigger = document.getElementById('contactFloatingTrigger');
  const panel = document.getElementById('contactFloatingPanel');
  const close = document.getElementById('contactPanelClose');

  if (!root || !trigger || !panel || !close) return;

  const setOpen = (open) => {
    root.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(!root.classList.contains('open'));
  });

  panel.addEventListener('click', (event) => event.stopPropagation());

  close.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(false);
    trigger.focus();
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.classList.contains('open')) {
      setOpen(false);
      trigger.focus();
    }
  });
})();
