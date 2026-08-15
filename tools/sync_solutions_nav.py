from pathlib import Path
import re

root = Path('.')
solutions_dir = root / 'pages' / 'solutions'

navbar_html = r'''
<div class="scroll-progress" id="scrollProgress"></div>

<header class="navbar" id="navbar">
    <div class="container navbar-inner">
        <a href="../../index.html#inicio" class="brand-logo" aria-label="ControlCenter - Página inicial">
            <img src="../../imgs/logo-controlcenter.webp" alt="ControlCenter">
        </a>

        <nav class="nav">
            <ul class="nav-links">
                <li><a href="../../index.html#inicio">Home</a></li>

                <li class="mega-wrapper">
                    <a href="../../index.html#solucoes">
                        Soluções
                        <i class="bi bi-chevron-down"></i>
                    </a>

                    <div class="mega-menu">
                        <div class="container mega-grid">
                            <div class="mega-intro">
                                <span class="mega-label">Soluções ControlCenter</span>
                                <h3>Tecnologia preparada para sua operação.</h3>
                                <p>Infraestrutura, segurança e suporte trabalhando juntos para manter sua empresa disponível, produtiva e protegida.</p>
                            </div>

                            <div class="mega-col">
                                <h4>Infraestrutura</h4>
                                <a href="gestao-de-redes.html"><i class="bi bi-diagram-3"></i>Gestão de Redes</a>
                                <a href="servidores.html"><i class="bi bi-server"></i>Servidores</a>
                                <a href="wifi-corporativo.html"><i class="bi bi-wifi"></i>Wi-Fi Corporativo</a>
                                <a href="conectividade.html"><i class="bi bi-router"></i>Conectividade</a>
                            </div>

                            <div class="mega-col">
                                <h4>Segurança</h4>
                                <a href="seguranca.html"><i class="bi bi-shield-check"></i>Segurança</a>
                                <a href="firewall.html"><i class="bi bi-bricks"></i>Firewall</a>
                                <a href="backup.html"><i class="bi bi-cloud-arrow-up"></i>Backup</a>
                                <a href="monitoramento.html"><i class="bi bi-activity"></i>Monitoramento</a>
                            </div>

                            <div class="mega-col">
                                <h4>Serviços</h4>
                                <a href="suporte-remoto.html"><i class="bi bi-headset"></i>Suporte Remoto</a>
                                <a href="suporte-presencial.html"><i class="bi bi-person-workspace"></i>Suporte Presencial</a>
                                <a href="gestao-de-ti.html"><i class="bi bi-gear"></i>Gestão de TI</a>
                                <a href="manutencao.html"><i class="bi bi-tools"></i>Manutenção</a>
                            </div>
                        </div>
                    </div>
                </li>

                <li><a href="../../index.html#empresa">Empresa</a></li>
                <li><a href="../../index.html#clientes">Clientes</a></li>
                <li><a href="../../index.html#insights">Conteúdos</a></li>
                <li><a href="../../index.html#contato">Contato</a></li>
            </ul>
        </nav>

        <div class="navbar-actions">
            <a href="../../index.html#contato" class="btn btn-outline"><span>Falar com especialista</span></a>
            <a href="#" class="btn btn-primary"><span>Área do Cliente</span><i class="bi bi-arrow-up-right"></i></a>
            <button class="menu-button" id="menuButton" type="button" aria-label="Abrir menu" aria-expanded="false">
                <i class="bi bi-list"></i>
            </button>
        </div>
    </div>
</header>

<nav class="mobile-menu" id="mobileMenu">
    <a href="../../index.html#inicio">Home <i class="bi bi-arrow-right"></i></a>
    <a href="../../index.html#solucoes">Soluções <i class="bi bi-arrow-right"></i></a>
    <a href="../../index.html#empresa">Empresa <i class="bi bi-arrow-right"></i></a>
    <a href="../../index.html#clientes">Clientes <i class="bi bi-arrow-right"></i></a>
    <a href="../../index.html#insights">Conteúdos <i class="bi bi-arrow-right"></i></a>
    <a href="../../index.html#contato">Contato <i class="bi bi-arrow-right"></i></a>
    <a href="#" class="mobile-client">Área do Cliente <i class="bi bi-arrow-up-right"></i></a>
</nav>
'''.strip()

navbar_css = r'''
/* Navbar compartilhada com a Home / index.html */
body.menu-open{overflow:hidden}
ul{list-style:none}
.scroll-progress{width:0;height:2px;position:fixed;top:0;left:0;z-index:99999;background:#174f82;pointer-events:none}
.navbar{height:88px;position:fixed;top:0;left:0;right:0;z-index:1000;background:rgba(255,255,255,.94);border-bottom:1px solid rgba(0,0,0,.06);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transition:height .25s ease,box-shadow .25s ease,background .25s ease}
.navbar.scrolled{height:76px;background:rgba(255,255,255,.98);box-shadow:0 15px 45px rgba(0,0,0,.055)}
.navbar .container{width:min(calc(100% - 80px),1380px);margin-inline:auto}
.navbar-inner{height:100%;display:grid;grid-template-columns:240px 1fr auto;align-items:center;gap:35px}
.brand-logo{width:fit-content;display:inline-flex;align-items:center;flex-shrink:0}
.brand-logo img{width:auto;height:49px;object-fit:contain;transition:transform .25s ease,opacity .25s ease}
.brand-logo:hover img{opacity:.86;transform:translateY(-1px)}
.navbar .nav{height:auto;display:block;align-items:initial;justify-content:initial;gap:0;justify-self:center}
.navbar .nav-links{display:flex;align-items:center;gap:31px;font-size:initial;font-weight:initial}
.navbar .nav-links>li>a{min-height:88px;position:relative;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;transition:color .2s ease,min-height .25s ease}
.navbar.scrolled .nav-links>li>a{min-height:76px}
.navbar .nav-links>li>a::after{content:"";position:absolute;left:0;right:100%;bottom:21px;height:2px;background:#174f82;transition:right .25s ease}
.navbar .nav-links>li>a:hover{color:#174f82}
.navbar .nav-links>li>a:hover::after{right:0}
.navbar .nav-links i{font-size:10px}
.navbar-actions{display:flex;align-items:center;gap:10px;justify-self:end}
.navbar-actions .btn{min-height:47px;padding:0 25px;position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;border:1px solid transparent;font-size:13px;font-weight:600;transition:transform .25s ease,color .25s ease,background .25s ease,border-color .25s ease,box-shadow .25s ease}
.navbar-actions .btn-outline{color:#111;background:transparent;border-color:#cecece}
.navbar-actions .btn-outline:hover{border-color:#111}
.navbar-actions .btn-primary{color:#fff;background:#174f82;border-color:#174f82}
.navbar-actions .btn-primary:hover{background:#0e385f;box-shadow:0 12px 28px rgba(23,79,130,.18)}
.navbar-actions .btn:hover{transform:translateY(-2px)}
.mega-wrapper{position:static}
.mega-menu{position:absolute;top:88px;left:0;right:0;padding:47px 0;background:#fff;border-top:1px solid #efefef;border-bottom:1px solid #e9e9e9;box-shadow:0 30px 55px rgba(0,0,0,.06);opacity:0;visibility:hidden;transform:translateY(-8px);transition:opacity .2s ease,visibility .2s ease,transform .2s ease,top .25s ease}
.navbar.scrolled .mega-menu{top:76px}
.mega-wrapper:hover .mega-menu{opacity:1;visibility:visible;transform:translateY(0)}
.mega-menu .container{width:min(calc(100% - 80px),1380px);margin-inline:auto}
.mega-grid{display:grid;grid-template-columns:1.25fr 1fr 1fr 1fr;gap:50px}
.mega-intro{padding-right:40px}
.mega-label{display:block;margin-bottom:15px;color:#174f82;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em}
.mega-intro h3{margin-bottom:17px;font-size:29px;font-weight:600;line-height:1.18;letter-spacing:-.05em}
.mega-intro p{color:#6b6b6b;font-size:13px;line-height:1.7}
.mega-col h4{margin-bottom:20px;color:#999;font-size:10px;text-transform:uppercase;letter-spacing:.12em}
.mega-col a{display:flex;align-items:center;gap:11px;padding:9px 0;margin:0;color:inherit;font-size:13px;font-weight:500;transition:color .2s ease,transform .2s ease}
.mega-col a i{width:19px;color:#174f82;font-size:15px}
.mega-col a:hover{color:#174f82;transform:translateX(3px)}
.menu-button{width:45px;height:45px;display:none;align-items:center;justify-content:center;border:none;color:#111;background:transparent;font-size:25px;cursor:pointer}
.mobile-menu{position:fixed;top:72px;left:0;right:0;bottom:0;z-index:999;padding:25px 22px 40px;background:#fff;overflow-y:auto;transform:translateX(100%);transition:transform .35s cubic-bezier(.2,.65,.3,1)}
.mobile-menu.active{transform:translateX(0)}
.mobile-menu>a{padding:19px 2px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ededed;font-size:23px;font-weight:600;letter-spacing:-.04em}
.mobile-menu>a i{color:#174f82;font-size:17px}
.mobile-menu .mobile-client{margin-top:30px;justify-content:center!important;color:#fff;background:#174f82;border:none!important;font-size:14px!important}
.mobile-menu .mobile-client i{color:#fff!important}
body>.navbar~main .hero{padding-top:184px}
@media(max-width:1200px){.navbar .container{width:min(calc(100% - 50px),1380px)}.navbar-inner{display:flex;justify-content:space-between}.navbar .nav{display:none}.menu-button{display:flex}.navbar-actions .btn-outline{display:none}}
@media(max-width:850px){.navbar,.navbar.scrolled{height:72px}.brand-logo img{height:40px}.navbar-actions .btn-primary{display:none}body>.navbar~main .hero{padding-top:135px}}
@media(max-width:600px){.navbar .container{width:calc(100% - 32px)}.brand-logo img{height:35px}body>.navbar~main .hero{padding-top:118px}}
'''.strip() + '\n'

navbar_js = r'''
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
'''.strip() + '\n'

(solutions_dir / 'navbar.css').write_text(navbar_css, encoding='utf-8')
(solutions_dir / 'navbar.js').write_text(navbar_js, encoding='utf-8')

for page in sorted(solutions_dir.glob('*.html')):
    html = page.read_text(encoding='utf-8')
    html, count = re.subn(
        r'<body><header class="site-header">.*?</header><main>',
        '<body>' + navbar_html + '<main>',
        html,
        count=1,
        flags=re.S,
    )
    if count != 1:
        raise RuntimeError(f'Navbar antiga não encontrada em {page}')

    if 'href="navbar.css"' not in html:
        html = html.replace(
            '<link rel="stylesheet" href="solutions.css">',
            '<link rel="stylesheet" href="solutions.css"><link rel="stylesheet" href="navbar.css">',
            1,
        )
    if 'src="navbar.js"' not in html:
        html = html.replace('</body>', '<script src="navbar.js"></script></body>', 1)
    page.write_text(html, encoding='utf-8')

index = root / 'index.html'
html = index.read_text(encoding='utf-8')

mega_targets = {
    ('bi-diagram-3', 'Gestão de Redes'): 'pages/solutions/gestao-de-redes.html',
    ('bi-server', 'Servidores'): 'pages/solutions/servidores.html',
    ('bi-wifi', 'Wi-Fi Corporativo'): 'pages/solutions/wifi-corporativo.html',
    ('bi-router', 'Conectividade'): 'pages/solutions/conectividade.html',
    ('bi-shield-check', 'Segurança'): 'pages/solutions/seguranca.html',
    ('bi-bricks', 'Firewall'): 'pages/solutions/firewall.html',
    ('bi-cloud-arrow-up', 'Backup'): 'pages/solutions/backup.html',
    ('bi-activity', 'Monitoramento'): 'pages/solutions/monitoramento.html',
    ('bi-headset', 'Suporte Remoto'): 'pages/solutions/suporte-remoto.html',
    ('bi-person-workspace', 'Suporte Presencial'): 'pages/solutions/suporte-presencial.html',
    ('bi-gear', 'Gestão de TI'): 'pages/solutions/gestao-de-ti.html',
    ('bi-tools', 'Manutenção'): 'pages/solutions/manutencao.html',
}

for (icon, label), target in mega_targets.items():
    pattern = rf'(<a\s+href=")[^"]+("[^>]*>\s*<i class="bi {re.escape(icon)}"></i>\s*{re.escape(label)}\s*</a>)'
    html, n = re.subn(pattern, rf'\1{target}\2', html, count=1, flags=re.S)
    if n != 1:
        raise RuntimeError(f'Link do mega menu não localizado: {label}')

service_card_targets = {
    'Suporte de TI': 'pages/solutions/suporte-remoto.html',
    'Segurança': 'pages/solutions/seguranca.html',
    'Backup': 'pages/solutions/backup.html',
    'Redes': 'pages/solutions/gestao-de-redes.html',
    'Servidores': 'pages/solutions/servidores.html',
    'Wi-Fi Corporativo': 'pages/solutions/wifi-corporativo.html',
}

services_start = html.index('<!-- =========================================================\n     SOLUÇÕES')
services_end = html.index('</section>', services_start) + len('</section>')
services = html[services_start:services_end]

def update_service_card(match):
    block = match.group(0)
    for label, target in service_card_targets.items():
        if re.search(rf'<h3>\s*{re.escape(label)}\s*</h3>', block, re.S):
            return re.sub(r'href="[^"]+"', f'href="{target}"', block, count=1)
    return block

services = re.sub(r'<a\s+href="[^"]+"\s+class="service-card[^>]*>.*?</a>', update_service_card, services, flags=re.S)
html = html[:services_start] + services + html[services_end:]

security_start = html.index('<!-- =========================================================\n     SEGURANÇA')
security_end = html.index('</section>', security_start) + len('</section>')
security = html[security_start:security_end]
security_targets = {
    'Segurança de rede': 'pages/solutions/seguranca.html',
    'Firewall': 'pages/solutions/firewall.html',
    'Proteção de endpoints': 'pages/solutions/seguranca.html',
    'Backup e recuperação': 'pages/solutions/backup.html',
    'Monitoramento': 'pages/solutions/monitoramento.html',
}

def update_security_link(match):
    block = match.group(0)
    for label, target in security_targets.items():
        if label in block:
            return re.sub(r'href="[^"]+"', f'href="{target}"', block, count=1)
    return block

security = re.sub(r'<a\s+href="[^"]+"\s+class="security-feature"\s*>.*?</a>', update_security_link, security, flags=re.S)
html = html[:security_start] + security + html[security_end:]
index.write_text(html, encoding='utf-8')

pages = sorted(solutions_dir.glob('*.html'))
assert len(pages) == 12, f'Esperadas 12 páginas, encontradas {len(pages)}'
required = [
    'gestao-de-redes.html','servidores.html','wifi-corporativo.html','conectividade.html',
    'seguranca.html','firewall.html','backup.html','monitoramento.html',
    'suporte-remoto.html','suporte-presencial.html','gestao-de-ti.html','manutencao.html'
]
for page in pages:
    text = page.read_text(encoding='utf-8')
    assert 'class="navbar"' in text
    assert 'class="mega-menu"' in text
    assert 'id="mobileMenu"' in text
    assert 'href="navbar.css"' in text
    assert 'src="navbar.js"' in text
    for href in required:
        assert href in text, f'{href} ausente em {page}'

home = index.read_text(encoding='utf-8')
for href in required:
    assert f'pages/solutions/{href}' in home, f'Redirecionamento ausente na Home: {href}'
