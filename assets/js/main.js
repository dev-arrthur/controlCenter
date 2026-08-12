const CONTROL_CENTER = {
  whatsapp: "5532984683427",
  // Atualize quando o domínio definitivo da área do cliente for informado.
  clientAreaUrl: "https://SEU-OUTRO-DOMINIO-AQUI.com.br/"
};

const buildWhatsAppUrl = (message) =>
  `https://wa.me/${CONTROL_CENTER.whatsapp}?text=${encodeURIComponent(message)}`;

document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.querySelector(".navbar-cc");

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
