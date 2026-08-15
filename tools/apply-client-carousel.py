from pathlib import Path
import re

path = Path('index.html')
html = path.read_text(encoding='utf-8')

# Replace only the moving-logo container. The client section title remains untouched.
start = html.index('<div class="client-logos">')
depth = 0
end = None
for match in re.finditer(r'<div\b|</div>', html[start:]):
    if match.group(0).startswith('<div'):
        depth += 1
    else:
        depth -= 1
        if depth == 0:
            end = start + match.end()
            break
if end is None:
    raise RuntimeError('Could not locate client-logos closing div')

carousel = '''<div class="client-logos" aria-label="Clientes ControlCenter">

            <div class="client-logos-track">

                <div class="client-logo"><img src="imgs/client-maximum.png" alt="Maximum Assessoria Contábil" loading="lazy"></div>
                <div class="client-logo"><img src="imgs/client-savino.png" alt="Grupo Savino" loading="lazy"></div>
                <div class="client-logo"><img src="imgs/client-martins-teixeira.png" alt="Martins Teixeira Consultoria Previdenciária" loading="lazy"></div>
                <div class="client-logo"><img src="imgs/client-implante-rio.png" alt="Implante Rio" loading="lazy"></div>
                <div class="client-logo"><img src="imgs/client-minas-gonzaga.png" alt="Minas Gonzaga Representações" loading="lazy"></div>
                <div class="client-logo"><img src="imgs/client-top-fitness.png" alt="Top Fitness" loading="lazy"></div>

                <div class="client-logo" aria-hidden="true"><img src="imgs/client-maximum.png" alt=""></div>
                <div class="client-logo" aria-hidden="true"><img src="imgs/client-savino.png" alt=""></div>
                <div class="client-logo" aria-hidden="true"><img src="imgs/client-martins-teixeira.png" alt=""></div>
                <div class="client-logo" aria-hidden="true"><img src="imgs/client-implante-rio.png" alt=""></div>
                <div class="client-logo" aria-hidden="true"><img src="imgs/client-minas-gonzaga.png" alt=""></div>
                <div class="client-logo" aria-hidden="true"><img src="imgs/client-top-fitness.png" alt=""></div>

            </div>

        </div>'''
html = html[:start] + carousel + html[end:]

start_marker = '/* CLIENT CAROUSEL + HERO SPACING START */'
end_marker = '/* CLIENT CAROUSEL + HERO SPACING END */'
if start_marker in html:
    a = html.index(start_marker)
    b = html.index(end_marker, a) + len(end_marker)
    html = html[:a] + html[b:]

overrides = r'''
        /* CLIENT CAROUSEL + HERO SPACING START */

        /* Section 1: static image with more breathing room. */
        .hero-visual {
            padding: 34px 0 34px 54px;
            background: transparent;
            animation: none;
        }

        .hero-art {
            width: min(620px, 100%);
            max-width: 100%;
            height: auto;
            object-fit: contain;
            background: transparent;
            border: 0;
            box-shadow: none;
            transform: none;
            animation: none;
            transition: none;
            filter: drop-shadow(0 24px 22px rgba(23,79,130,.09));
        }

        /* Client title remains fixed; only logos move. */
        .client-logos {
            width: 100%;
            min-width: 0;
            display: block;
            position: relative;
            overflow: hidden;
            -webkit-mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
            mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
        }

        .client-logos-track {
            width: max-content;
            display: flex;
            align-items: center;
            gap: 58px;
            animation: clientLogoCarousel 28s linear infinite;
            will-change: transform;
        }

        .client-logos:hover .client-logos-track {
            animation-play-state: paused;
        }

        .client-logo {
            width: 185px;
            min-width: 185px;
            min-height: 76px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: .82;
            color: inherit;
            font-size: inherit;
            font-weight: inherit;
            transition: opacity .25s ease, transform .25s ease;
        }

        .client-logo img {
            width: auto;
            height: auto;
            max-width: 180px;
            max-height: 70px;
            object-fit: contain;
        }

        .client-logo:hover {
            opacity: 1;
            color: inherit;
            transform: scale(1.035);
        }

        @keyframes clientLogoCarousel {
            from { transform: translate3d(0, 0, 0); }
            to { transform: translate3d(calc(-50% - 29px), 0, 0); }
        }

        @media (max-width: 1200px) {
            .hero-visual { padding: 24px 0; }
            .hero-art { width: min(590px, 92%); }
        }

        @media (max-width: 850px) {
            .client-logos { width: 100%; display: block; }
            .client-logos-track { gap: 42px; animation-duration: 24s; }
            .client-logo { width: 165px; min-width: 165px; min-height: 70px; }
            .client-logo img { max-width: 160px; max-height: 62px; }
            .hero-art { width: min(560px, 94%); }
        }

        @media (max-width: 600px) {
            .hero-visual { min-height: 390px; padding: 18px 0; }
            .hero-art { width: min(520px, 96%); }
        }

        @media (prefers-reduced-motion: reduce) {
            .client-logos {
                -webkit-mask-image: none;
                mask-image: none;
                overflow: visible;
            }
            .client-logos-track {
                width: 100%;
                flex-wrap: wrap;
                justify-content: center;
                transform: none !important;
                animation: none !important;
            }
            .client-logo[aria-hidden="true"] { display: none; }
        }

        /* CLIENT CAROUSEL + HERO SPACING END */
'''
html = html.replace('    </style>', overrides + '\n    </style>', 1)
path.write_text(html, encoding='utf-8')
