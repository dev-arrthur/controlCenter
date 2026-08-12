const CONTROL_CENTER = {
  whatsapp: "5532984683427",
  // Atualize quando o domínio definitivo da área do cliente for informado.
  clientAreaUrl: "https://SEU-OUTRO-DOMINIO-AQUI.com.br/"
};

const buildWhatsAppUrl = (message) =>
  `https://wa.me/${CONTROL_CENTER.whatsapp}?text=${encodeURIComponent(message)}`;

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

const loadStylesheet = (href, marker) => {
  if (document.querySelector(`link[data-${marker}]`)) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute(`data-${marker}`, "true");
  document.head.appendChild(link);
};

const isHomePage = () =>
  Boolean(document.querySelector(".hero") && document.querySelector("#planos"));

const injectTrustedCompaniesSection = () => {
  if (document.querySelector("#clientes")) return;

  const clients = [
    { name: "Maximum Assessoria Contábil", image: "assets/images/clients/maximum.webp" },
    { name: "Martins Teixeira Consultoria Previdenciária", image: "assets/images/clients/martins-teixeira.webp" },
    { name: "ImplanteRio", image: "assets/images/clients/implante-rio.webp" },
    { name: "Grupo Savino", image: "assets/images/clients/grupo-savino.webp" },
    { name: "Minas Gonzaga Representações", image: "assets/images/clients/minas-gonzaga.webp" },
    { name: "Top Fitness", image: "assets/images/clients/top-fitness.webp" }
  ];

  const logos = [...clients, ...clients]
    .map((client, index) => {
      const duplicate = index >= clients.length;
      const alt = duplicate ? "" : `Logo ${client.name}`;
      const hidden = duplicate ? ' aria-hidden="true"' : "";

      return `
        <div class="client-logo-card"${hidden}>
          <img src="${client.image}" alt="${alt}" loading="lazy" decoding="async" width="180" height="70">
        </div>`;
    })
    .join("");

  const section = document.createElement("section");
  section.id = "clientes";
  section.className = "section-pad clients-section";
  section.setAttribute("aria-labelledby", "clients-title");
  section.innerHTML = `
    <div class="container">
      <div class="clients-heading reveal">
        <span class="eyebrow">Confiança construída no dia a dia</span>
        <h2 class="section-title" id="clients-title">Empresas que confiam em nosso trabalho</h2>
        <p class="section-lead">Tecnologia, suporte e infraestrutura acompanhando operações que precisam continuar funcionando.</p>
      </div>
    </div>
    <div class="clients-marquee reveal" role="region" aria-label="Empresas atendidas pela Control Center">
      <div class="clients-track">${logos}</div>
    </div>`;

  const companySection = document.querySelector(".company-panel")?.closest("section");
  const faqSection = document.querySelector(".faq")?.closest("section");

  if (companySection) {
    companySection.insertAdjacentElement("afterend", section);
  } else if (faqSection) {
    faqSection.insertAdjacentElement("beforebegin", section);
  } else {
    document.querySelector("main")?.appendChild(section);
  }
};

const injectTechnologyNewsSection = () => {
  if (document.querySelector("#noticias")) return;

  const news = [
    {
      category: "Infraestrutura & IA",
      source: "TechCrunch",
      date: "23 jul 2026",
      icon: "bi-cpu",
      title: "AMD amplia a disputa por infraestrutura de IA com o sistema Helios",
      excerpt: "O sistema em escala de rack mira grandes cargas de inteligência artificial e amplia a competição no mercado de data centers.",
      url: "https://techcrunch.com/2026/07/23/amd-takes-on-nvidia-with-its-helios-ai-rack-scale-system/"
    },
    {
      category: "Cibersegurança",
      source: "Reuters",
      date: "07 ago 2026",
      icon: "bi-shield-lock",
      title: "Novos modelos de IA elevam a atenção sobre riscos de cibersegurança",
      excerpt: "O avanço das capacidades autônomas de IA está levando empresas de tecnologia a reforçar controles e protocolos de segurança.",
      url: "https://www.reuters.com/legal/litigation/openai-flags-possible-critical-cybersecurity-risk-upcoming-model-tightens-2026-08-07/"
    },
    {
      category: "Inteligência Artificial",
      source: "TechCrunch",
      date: "23 jul 2026",
      icon: "bi-soundwave",
      title: "Claude ganha modo de voz com modelos mais capazes e integração com ferramentas",
      excerpt: "A Anthropic ampliou o modo de voz do Claude para conversas mais complexas e conexão com aplicativos usados no trabalho.",
      url: "https://techcrunch.com/2026/07/23/anthropic-updates-claude-voice-mode-with-more-capable-models/"
    }
  ];

  const cards = news
    .map(
      (item) => `
        <div class="col-lg-4 reveal">
          <article class="news-card">
            <div class="news-card-top" aria-hidden="true">
              <div class="news-card-icon"><i class="bi ${item.icon}"></i></div>
            </div>
            <div class="news-card-body">
              <div class="news-meta">
                <span class="news-category">${item.category}</span>
                <span>${item.source}</span>
                <span aria-hidden="true">•</span>
                <time>${item.date}</time>
              </div>
              <h3>${item.title}</h3>
              <p>${item.excerpt}</p>
              <a class="news-link" href="${item.url}" target="_blank" rel="noopener noreferrer" aria-label="Ler notícia em ${item.source}: ${item.title}">
                Ler notícia <i class="bi bi-arrow-up-right"></i>
              </a>
            </div>
          </article>
        </div>`
    )
    .join("");

  const section = document.createElement("section");
  section.id = "noticias";
  section.className = "section-pad tech-news-section";
  section.setAttribute("aria-labelledby", "news-title");
  section.innerHTML = `
    <div class="container">
      <div class="news-header reveal">
        <div class="news-header-copy">
          <span class="eyebrow">Radar de tecnologia</span>
          <h2 class="section-title mb-3" id="news-title">O que está movimentando o mundo da tecnologia</h2>
          <p class="section-lead mb-0">Uma seleção de assuntos recentes sobre infraestrutura, inteligência artificial e segurança digital.</p>
        </div>
        <p class="news-header-note mb-0">Notícias publicadas por veículos externos. Os links abrem a matéria original em uma nova aba.</p>
      </div>
      <div class="row g-4">${cards}</div>
      <p class="news-source-note mb-0">Seleção editorial da Control Center. O conteúdo das matérias pertence aos respectivos veículos.</p>
    </div>`;

  const ctaSection = document.querySelector(".cta-panel")?.closest("section");
  const main = document.querySelector("main");

  if (ctaSection) {
    ctaSection.insertAdjacentElement("afterend", section);
  } else if (main) {
    main.appendChild(section);
  }
};

const cleanDashCopy = () => {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script,style,noscript")) return NodeFilter.FILTER_REJECT;
        return /[—–]/.test(node.nodeValue || "")
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    node.nodeValue = (node.nodeValue || "").replace(/\s*[—–]\s*/g, ", ");
  });
};

const setupScrollProgress = () => {
  if (document.querySelector(".scroll-progress")) return;

  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.innerHTML = "<span></span>";
  document.body.appendChild(progress);

  const update = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = maxScroll > 0 ? Math.min(Math.max(window.scrollY / maxScroll, 0), 1) : 0;
    progress.style.setProperty("--scroll-progress", ratio.toFixed(4));
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
};

const setupRevealAnimations = () => {
  const selector = [
    ".reveal",
    ".solution-card",
    ".value-card",
    ".team-card",
    ".contact-card",
    ".pain-card",
    ".company-stat",
    ".plan-row",
    ".trust-item"
  ].join(",");

  const elements = [...document.querySelectorAll(selector)];
  const variants = ["reveal-left", "reveal-right", "reveal-scale", ""];

  elements.forEach((element, index) => {
    element.classList.add("motion-item");

    if (!element.classList.contains("reveal-left") &&
        !element.classList.contains("reveal-right") &&
        !element.classList.contains("reveal-scale")) {
      const variant = variants[index % variants.length];
      if (variant) element.classList.add(variant);
    }

    element.style.setProperty("--reveal-delay", `${Math.min((index % 5) * 70, 280)}ms`);
  });

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.11, rootMargin: "0px 0px -6% 0px" }
  );

  elements.forEach((element) => observer.observe(element));
};

const setupSectionAnimations = () => {
  const sections = [...document.querySelectorAll("main > section")];

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    sections.forEach((section) => section.classList.add("section-in-view"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("section-in-view");
      });
    },
    { threshold: 0.18 }
  );

  sections.forEach((section) => observer.observe(section));
};

const setupHeroParallax = () => {
  const hero = document.querySelector(".hero");
  if (!hero || prefersReducedMotion()) return;

  let ticking = false;

  const update = () => {
    const rect = hero.getBoundingClientRect();
    const visible = rect.bottom > 0 && rect.top < window.innerHeight;

    if (visible) {
      const progress = Math.min(Math.max(-rect.top / Math.max(hero.offsetHeight, 1), 0), 1);
      hero.style.setProperty("--hero-shift", `${progress * 34}px`);
      hero.style.setProperty("--pixel-shift", `${progress * 18}px`);
    }

    ticking = false;
  };

  const requestUpdate = () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  };

  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
};

const setupPointerTilt = () => {
  if (prefersReducedMotion() || !window.matchMedia?.("(pointer:fine)")?.matches) return;

  const surfaces = document.querySelectorAll(
    ".solution-card,.news-card,.value-card,.team-card,.contact-card,.pain-card,.company-stat"
  );

  surfaces.forEach((surface) => {
    surface.addEventListener("pointermove", (event) => {
      const rect = surface.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      const rotateY = x * 4.5;
      const rotateX = y * -4.5;

      surface.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
    });

    surface.addEventListener("pointerleave", () => {
      surface.style.transform = "";
    });
  });
};

const setupNavbar = () => {
  const navbar = document.querySelector(".navbar-cc");

  const updateNavbar = () => {
    if (navbar) navbar.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  updateNavbar();
  window.addEventListener("scroll", updateNavbar, { passive: true });

  const navCollapse = document.querySelector("#mainNav");
  document.querySelectorAll("#mainNav .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth < 992 && navCollapse?.classList.contains("show") && window.bootstrap) {
        bootstrap.Collapse.getOrCreateInstance(navCollapse).hide();
      }
    });
  });
};

const setupLinks = () => {
  document.querySelectorAll("[data-client-area]").forEach((link) => {
    link.href = CONTROL_CENTER.clientAreaUrl;
  });

  document.querySelectorAll("[data-whatsapp-message]").forEach((link) => {
    const message = link.dataset.whatsappMessage || "Olá! Vim pelo site da Control Center.";
    link.href = buildWhatsAppUrl(message);
  });
};

const setupContactForm = () => {
  const contactForm = document.querySelector("#contactForm");
  if (!contactForm) return;

  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!contactForm.checkValidity()) {
      contactForm.classList.add("was-validated");
      return;
    }

    const data = new FormData(contactForm);
    const message = [
      "Olá! Vim pelo site da Control Center e gostaria de solicitar um orçamento.",
      "",
      `Nome: ${data.get("nome") || ""}`,
      `Empresa: ${data.get("empresa") || ""}`,
      `WhatsApp: ${data.get("telefone") || ""}`,
      `Computadores: ${data.get("computadores") || "Não informado"}`,
      `Assunto: ${data.get("assunto") || ""}`,
      `Mensagem: ${data.get("mensagem") || "Não informada"}`
    ].join("\n");

    window.open(buildWhatsAppUrl(message), "_blank", "noopener,noreferrer");
  });
};

document.addEventListener("DOMContentLoaded", () => {
  loadStylesheet("assets/css/theme-v2.css", "theme-v2-css");

  if (isHomePage()) {
    loadStylesheet("assets/css/home-sections.css", "home-sections-css");
    injectTrustedCompaniesSection();
    injectTechnologyNewsSection();
  }

  cleanDashCopy();
  setupLinks();
  setupContactForm();
  setupNavbar();
  setupScrollProgress();
  setupRevealAnimations();
  setupSectionAnimations();
  setupHeroParallax();
  setupPointerTilt();
});
