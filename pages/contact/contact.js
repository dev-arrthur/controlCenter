document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('contactForm');

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      const name = document.getElementById('contactName')?.value.trim() || '';
      const company = document.getElementById('contactCompany')?.value.trim() || '';
      const email = document.getElementById('contactEmail')?.value.trim() || '';
      const phone = document.getElementById('contactPhone')?.value.trim() || '';
      const subject = document.getElementById('contactSubject')?.value.trim() || '';
      const message = document.getElementById('contactMessage')?.value.trim() || '';

      const lines = [
        'Olá ControlCenter! Gostaria de falar com um especialista.',
        '',
        `Nome: ${name}`,
        company ? `Empresa: ${company}` : null,
        email ? `E-mail: ${email}` : null,
        phone ? `Telefone: ${phone}` : null,
        `Assunto: ${subject}`,
        '',
        'Mensagem:',
        message
      ].filter(Boolean);

      const url = `https://wa.me/5532984683427?text=${encodeURIComponent(lines.join('\n'))}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  document.querySelectorAll('.contact-faq-list details').forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;
      document.querySelectorAll('.contact-faq-list details').forEach(function (other) {
        if (other !== item) other.open = false;
      });
    });
  });
});
