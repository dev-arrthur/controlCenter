(() => {
  const testimonialStyle = document.createElement('style');
  testimonialStyle.setAttribute('data-controlcenter-testimonials', 'true');
  testimonialStyle.textContent = `
    /* Depoimentos — refinamento visual sem alterar a estrutura da página */
    .clients-page .voice-section {
      position: relative;
      overflow: hidden;
    }

    .clients-page .voice-section::after {
      content: "";
      width: 430px;
      height: 430px;
      position: absolute;
      left: -210px;
      bottom: -320px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 50%;
      pointer-events: none;
    }

    .clients-page .voice-grid {
      gap: clamp(48px, 6vw, 90px);
    }

    .clients-page .voice-stage {
      min-height: 520px;
      position: relative;
    }

    .clients-page .voice-card {
      min-height: 520px;
      padding: 46px 52px 38px;
      overflow: hidden;
      justify-content: flex-start;
      box-shadow: 0 28px 75px rgba(6,30,50,.17);
    }

    .clients-page .voice-card::before {
      content: "VOZ DO CLIENTE";
      position: absolute;
      top: 30px;
      right: 34px;
      color: #8b98a2;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: .16em;
    }

    .clients-page .quote-mark {
      height: 58px;
      flex: 0 0 auto;
      margin: 5px 0 20px;
      color: rgba(23,79,130,.22);
      font-size: 88px;
      line-height: .78;
    }

    .clients-page .voice-card > p {
      max-width: 760px;
      flex: 1 1 auto;
      margin: 0;
      padding: 22px 0 38px;
      display: flex;
      align-items: center;
      color: #101214;
      font-size: clamp(30px, 3vw, 44px);
      line-height: 1.15;
      letter-spacing: -.043em;
    }

    .clients-page .voice-person {
      min-height: 92px;
      flex: 0 0 auto;
      padding: 24px 0 0;
      display: grid;
      grid-template-columns: 150px minmax(0,1fr);
      align-items: center;
      gap: 24px;
      border-top: 1px solid #dfe5ea;
    }

    .clients-page .voice-person img {
      width: auto;
      height: auto;
      max-width: 138px;
      max-height: 58px;
      object-fit: contain;
      object-position: left center;
    }

    .clients-page .voice-person > div {
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 6px;
    }

    .clients-page .voice-person strong {
      display: block;
      color: #121416;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.3;
    }

    .clients-page .voice-person span {
      display: block;
      margin: 0;
      color: #7e8a94;
      font-size: 9px;
      font-weight: 700;
      line-height: 1.45;
      letter-spacing: .14em;
      text-transform: uppercase;
    }

    .clients-page .voice-controls button {
      border-radius: 50%;
    }

    @media (max-width: 1200px) {
      .clients-page .voice-stage,
      .clients-page .voice-card {
        min-height: 470px;
      }
    }

    @media (max-width: 850px) {
      .clients-page .voice-stage,
      .clients-page .voice-card {
        min-height: 450px;
      }

      .clients-page .voice-card {
        padding: 40px 38px 32px;
      }

      .clients-page .voice-card > p {
        font-size: clamp(28px, 5vw, 38px);
      }
    }

    @media (max-width: 600px) {
      .clients-page .voice-grid {
        gap: 40px;
      }

      .clients-page .voice-stage,
      .clients-page .voice-card {
        min-height: 455px;
      }

      .clients-page .voice-card {
        padding: 32px 24px 26px;
      }

      .clients-page .voice-card::before {
        top: 22px;
        right: 22px;
        font-size: 7px;
      }

      .clients-page .quote-mark {
        height: 48px;
        margin-bottom: 12px;
        font-size: 66px;
      }

      .clients-page .voice-card > p {
        padding: 16px 0 28px;
        font-size: clamp(25px, 7vw, 32px);
        line-height: 1.18;
      }

      .clients-page .voice-person {
        min-height: 0;
        padding-top: 20px;
        grid-template-columns: 112px minmax(0,1fr);
        gap: 16px;
        align-items: center;
      }

      .clients-page .voice-person img {
        max-width: 108px;
        max-height: 44px;
      }

      .clients-page .voice-person strong {
        font-size: 13px;
      }

      .clients-page .voice-person span {
        font-size: 7px;
        letter-spacing: .11em;
      }
    }
  `;
  document.head.appendChild(testimonialStyle);

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
