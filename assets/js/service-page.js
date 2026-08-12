const SERVICE_DETAILS = {
  redes: {
    label: "Gestão de Redes",
    icon: "bi-diagram-3",
    title: "Uma rede estável para sua equipe trabalhar sem interrupções desnecessárias.",
    intro: "Organizamos e acompanhamos a infraestrutura que conecta computadores, servidores, impressoras, sistemas e internet dentro da empresa.",
    benefits: [
      ["bi-speedometer2", "Mais estabilidade", "Reduzimos pontos de falha e organizamos a conectividade para melhorar o uso diário."],
      ["bi-shield-check", "Mais controle", "Equipamentos, acessos e estrutura ficam mais claros para manutenção e suporte."],
      ["bi-arrows-angle-expand", "Pronta para crescer", "A rede pode ser planejada para acompanhar novos usuários, setores e equipamentos."]
    ],
    includes: ["Diagnóstico da rede atual", "Configuração de roteadores, switches e equipamentos de rede", "Organização de endereçamento e acessos", "Segmentação da rede quando necessária", "Documentação e acompanhamento técnico"],
    pain: "Está enfrentando lentidão, quedas ou uma rede difícil de administrar?",
    message: "Olá! Gostaria de solicitar um orçamento para gestão de redes empresariais."
  },
  wifi: {
    label: "Wi-Fi Corporativo",
    icon: "bi-wifi",
    title: "Cobertura e estabilidade para conectar sua equipe em todos os ambientes.",
    intro: "Planejamos o Wi-Fi empresarial de acordo com o espaço, a quantidade de dispositivos, as áreas de uso e as necessidades de segurança.",
    benefits: [
      ["bi-broadcast-pin", "Melhor cobertura", "Pontos de acesso posicionados de acordo com o ambiente e a demanda."],
      ["bi-lightning-charge", "Mais estabilidade", "Menos perda de conexão durante o expediente e melhor experiência para os usuários."],
      ["bi-shield-lock", "Acesso organizado", "Separação entre usuários, visitantes e recursos internos quando necessário."]
    ],
    includes: ["Análise de cobertura e pontos de sombra", "Definição e configuração de pontos de acesso", "Rede para visitantes quando necessária", "Organização de segurança e acessos", "Acompanhamento técnico do ambiente"],
    pain: "Seu Wi-Fi tem pontos sem sinal ou cai durante o expediente?",
    message: "Olá! Gostaria de solicitar um orçamento para Wi-Fi corporativo."
  },
  seguranca: {
    label: "Segurança da Informação",
    icon: "bi-shield-check",
    title: "Mais controle sobre acessos, dispositivos e riscos no ambiente de TI.",
    intro: "Ajudamos a reduzir exposição a acessos indevidos, falhas de configuração e ameaças que podem afetar dados e continuidade da operação.",
    benefits: [
      ["bi-person-lock", "Acessos mais claros", "Usuários e permissões podem ser organizados de acordo com a necessidade de cada função."],
      ["bi-bug", "Menos exposição", "Boas práticas e controles ajudam a reduzir riscos comuns do ambiente empresarial."],
      ["bi-clipboard-check", "Rotina mais segura", "A segurança passa a fazer parte da manutenção e do acompanhamento da infraestrutura."]
    ],
    includes: ["Revisão de acessos e permissões", "Proteção e configuração de dispositivos", "Orientação sobre boas práticas", "Apoio na organização de firewall e rede", "Acompanhamento dos pontos críticos conforme contratação"],
    pain: "Quer entender onde a infraestrutura da sua empresa está mais exposta?",
    message: "Olá! Gostaria de solicitar um orçamento para segurança da informação."
  },
  backup: {
    label: "Backup Corporativo",
    icon: "bi-cloud-check",
    title: "Cópias organizadas para reduzir o impacto de perda ou exclusão de dados.",
    intro: "Estruturamos rotinas de backup e acompanhamento para que arquivos importantes não dependam de processos manuais ou esquecidos.",
    benefits: [
      ["bi-arrow-repeat", "Rotina automática", "Reduz a dependência de tarefas manuais para manter cópias atualizadas."],
      ["bi-eye", "Acompanhamento", "Falhas podem ser identificadas mais cedo quando a rotina é monitorada."],
      ["bi-life-preserver", "Mais preparo", "Uma estrutura de backup bem organizada facilita a recuperação quando algo acontece."]
    ],
    includes: ["Levantamento dos dados importantes", "Definição das rotinas de cópia", "Configuração das tarefas de backup", "Acompanhamento de falhas conforme contrato", "Apoio à recuperação e validação quando aplicável"],
    pain: "Se um arquivo importante sumisse hoje, sua empresa saberia como recuperar?",
    message: "Olá! Gostaria de solicitar um orçamento para backup corporativo."
  },
  servidores: {
    label: "Servidores",
    icon: "bi-hdd-rack",
    title: "Servidores organizados para centralizar arquivos, usuários e recursos da empresa.",
    intro: "Planejamos e acompanhamos ambientes de servidor para facilitar acessos, permissões, compartilhamentos e serviços usados pela equipe.",
    benefits: [
      ["bi-folder2-open", "Arquivos centralizados", "A equipe trabalha com uma estrutura mais organizada para armazenamento e compartilhamento."],
      ["bi-people", "Permissões por usuário", "Acessos podem ser definidos de acordo com setores e responsabilidades."],
      ["bi-activity", "Acompanhamento técnico", "O ambiente fica mais simples de administrar e manter ao longo do tempo."]
    ],
    includes: ["Servidor de arquivos", "Usuários e permissões", "Serviços de domínio quando necessários", "Acesso remoto e integração com VPN quando aplicável", "Manutenção e acompanhamento técnico"],
    pain: "Sua empresa precisa organizar arquivos, usuários e acessos em um ambiente central?",
    message: "Olá! Gostaria de solicitar um orçamento para servidores empresariais."
  },
  vpn: {
    label: "VPN e Acesso Remoto",
    icon: "bi-lock",
    title: "Acesso remoto para trabalhar fora da empresa com mais controle.",
    intro: "Configuramos conexões para usuários autorizados acessarem recursos internos sem expor a rede de forma desnecessária.",
    benefits: [
      ["bi-house-lock", "Acesso fora do escritório", "Usuários autorizados podem acessar recursos internos quando precisam trabalhar remotamente."],
      ["bi-shield-lock", "Conexão protegida", "A VPN cria um caminho controlado entre o usuário e a rede da empresa."],
      ["bi-person-check", "Controle por usuário", "O acesso pode ser limitado às pessoas e aos recursos realmente necessários."]
    ],
    includes: ["Configuração de VPN", "Definição de usuários autorizados", "Integração com recursos internos", "Orientação para uso nos dispositivos", "Suporte e acompanhamento conforme contratação"],
    pain: "Sua equipe precisa acessar arquivos ou sistemas da empresa fora do escritório?",
    message: "Olá! Gostaria de solicitar um orçamento para VPN e acesso remoto."
  },
  manutencao: {
    label: "Manutenção de Computadores",
    icon: "bi-pc-display",
    title: "Computadores mais confiáveis para a equipe trabalhar com menos interrupções.",
    intro: "Diagnosticamos problemas de hardware e software, fazemos manutenção preventiva e orientamos melhorias quando o equipamento já não atende bem à rotina.",
    benefits: [
      ["bi-tools", "Diagnóstico técnico", "Identificamos a origem de lentidão, falhas e problemas de funcionamento."],
      ["bi-speedometer", "Melhor desempenho", "Upgrades podem prolongar a vida útil de equipamentos quando fazem sentido."],
      ["bi-calendar-check", "Prevenção", "Manutenções periódicas ajudam a reduzir falhas inesperadas no dia a dia."]
    ],
    includes: ["Diagnóstico de hardware e software", "Manutenção preventiva", "Limpeza e revisão técnica quando necessária", "Upgrades de memória e armazenamento quando indicados", "Padronização e configuração dos computadores da empresa"],
    pain: "Computadores lentos e falhas recorrentes estão atrapalhando sua equipe?",
    message: "Olá! Gostaria de solicitar um orçamento para manutenção de computadores."
  }
};

const renderServicePage = () => {
  const key = document.body.dataset.service;
  const service = SERVICE_DETAILS[key];
  const mount = document.querySelector("#service-content");
  if (!service || !mount) return;

  const benefits = service.benefits.map(([icon, title, text]) => `
    <article class="detail-card reveal">
      <i class="bi ${icon}"></i>
      <h3>${title}</h3>
      <p>${text}</p>
    </article>`).join("");

  const includes = service.includes.map((item) => `
    <li><i class="bi bi-check-circle-fill"></i><span>${item}</span></li>`).join("");

  mount.innerHTML = `
    <section class="service-hero">
      <div class="container">
        <div class="service-hero-copy reveal">
          <div class="service-breadcrumb"><a href="index.html">Home</a><i class="bi bi-chevron-right"></i><a href="solucoes.html">Soluções</a><i class="bi bi-chevron-right"></i><span>${service.label}</span></div>
          <div class="service-icon-large"><i class="bi ${service.icon}"></i></div>
          <span class="eyebrow">${service.label}</span>
          <h1>${service.title}</h1>
          <p>${service.intro}</p>
          <div class="service-hero-actions">
            <a class="btn btn-cc btn-cc-primary" data-whatsapp-message="${service.message}" href="#" target="_blank"><i class="bi bi-whatsapp me-2"></i>Solicitar orçamento</a>
            <a class="btn btn-cc btn-cc-light-outline" href="solucoes.html">Ver outras soluções</a>
          </div>
        </div>
      </div>
    </section>
    <section class="section-pad">
      <div class="container">
        <div class="row g-5 align-items-start">
          <div class="col-lg-5 reveal"><span class="eyebrow">Benefícios</span><h2 class="section-title">O que melhora na rotina da empresa.</h2><p class="section-lead">A solução é definida de acordo com o ambiente atual, os problemas percebidos pela equipe e o nível de acompanhamento necessário.</p></div>
          <div class="col-lg-7"><div class="detail-grid">${benefits}</div></div>
        </div>
      </div>
    </section>
    <section class="section-pad section-soft">
      <div class="container">
        <div class="row g-5 align-items-center">
          <div class="col-lg-7 reveal"><span class="eyebrow">O que podemos fazer</span><h2 class="section-title">Um escopo definido a partir da necessidade real da empresa.</h2><p class="section-lead">Primeiro entendemos o cenário. Depois organizamos as prioridades e indicamos o que faz sentido ajustar, implantar ou acompanhar.</p></div>
          <div class="col-lg-5 reveal"><div class="service-list-panel"><h2>O serviço pode incluir</h2><ul class="service-check-list">${includes}</ul></div></div>
        </div>
      </div>
    </section>
    <section class="section-pad">
      <div class="container"><span class="eyebrow">Como funciona</span><h2 class="section-title mb-5">Da análise ao acompanhamento.</h2><div class="process-grid">
        <div class="process-step reveal"><div class="process-number">1</div><h3>Entendimento</h3><p>Conversamos sobre a rotina e os problemas atuais.</p></div>
        <div class="process-step reveal"><div class="process-number">2</div><h3>Diagnóstico</h3><p>Avaliamos os pontos que merecem atenção primeiro.</p></div>
        <div class="process-step reveal"><div class="process-number">3</div><h3>Implantação</h3><p>Executamos os ajustes definidos no escopo aprovado.</p></div>
        <div class="process-step reveal"><div class="process-number">4</div><h3>Acompanhamento</h3><p>O ambiente pode seguir acompanhado conforme a contratação.</p></div>
      </div></div>
    </section>
    <section class="section-pad pt-0"><div class="container"><div class="service-cta reveal"><span class="eyebrow" style="color:#d8f5ff">Fale com a Control Center</span><h2>${service.pain}</h2><p>Conte o que está acontecendo e nossa equipe ajuda a entender quais próximos passos fazem sentido.</p><a class="btn btn-cc btn-cc-outline mt-3" data-whatsapp-message="${service.message}" href="#" target="_blank"><i class="bi bi-whatsapp me-2"></i>Conversar no WhatsApp</a></div></div></section>`;
};

document.addEventListener("DOMContentLoaded", renderServicePage);
