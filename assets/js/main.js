const CONTROL_CENTER = {
  whatsapp: "5532984683427",
  // Atualize quando o domínio definitivo da área do cliente for informado.
  clientAreaUrl: "https://SEU-OUTRO-DOMINIO-AQUI.com.br/"
};

const buildWhatsAppUrl = (message) =>
  `https://wa.me/${CONTROL_CENTER.whatsapp}?text=${encodeURIComponent(message)}`;

const isHomePage = () => {
  const path = window.location.pathname.replace(/\/+$/, "");
  return path === "" || path.endsWith("/index.html") || path === "/index.html";
};

const loadHomeSectionsStyles = () => {
  if (document.querySelector('link[data-home-sections-css]')) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "assets/css/home-sections.css";
  link.dataset.homeSectionsCss = "true";
  document.head.appendChild(link);
};

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
  if (companySection) companySection.insertAdjacentElement("afterend", section);
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
      excerpt: "O novo sistema em escala de rack mira grandes cargas de inteligência artificial e amplia a competição no mercado de data centers.",
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
      <p class="news-source-note mb-0">Seleção editorial da Control Center • Conteúdo das matérias pertence aos respectivos veículos.</p>
    </div>`;

  const ctaSection = document.querySelector(".cta-panel")?.closest("section");
  const main = document.querySelector("main");

  if (ctaSection) {
    ctaSection.insertAdjacentElement("afterend", section);
  } else if (main) {
    main.appendChild(section);
  }
};

const injectHomeSections = () => {
  if (!isHomePage()) return;
  loadHomeSectionsStyles();
  injectTrustedCompaniesSection();
  injectTechnologyNewsSection();
};

document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.querySelector(".navbar-cc");

  injectHomeSections();

  const updateNavbar = () => {
    if (navbar) navbar.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  updateNavbar();
  window.addEventListener("scroll", updateNavbar, { passive: true });

  document.querySelectorAll("[data-client-area]").forEach((link) => {
    link.href = CONTROL_CENTER.clientAreaUrl;
  });

  document.querySelectorAll("[data-whatsapp-message]").forEach((link) => {
    const message = link.dataset.whatsappMessage || "Olá! Vim pelo site da Control Center.";
    link.href = buildWhatsAppUrl(message);
  });

  const contactForm = document.querySelector("#contactForm");

  if (contactForm) {
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
  }

  const revealElements = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add("is-visible"));
  }

  const navCollapse = document.querySelector("#mainNav");
  document.querySelectorAll("#mainNav .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth < 992 && navCollapse?.classList.contains("show")) {
        bootstrap.Collapse.getOrCreateInstance(navCollapse).hide();
      }
    });
  });
});
