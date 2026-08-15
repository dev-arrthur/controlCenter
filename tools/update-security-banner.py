from pathlib import Path
import re

path = Path("index.html")
html = path.read_text(encoding="utf-8")

start_tag = '<div class="security-visual reveal-left">'
start = html.find(start_tag)
if start == -1:
    raise RuntimeError("security visual not found")

depth = 0
end = None
for match in re.finditer(r"<div\b|</div>", html[start:]):
    if match.group(0).startswith("<div"):
        depth += 1
    else:
        depth -= 1
        if depth == 0:
            end = start + match.end()
            break

if end is None:
    raise RuntimeError("security visual closing div not found")

replacement = '''<div class="security-visual reveal-left">

            <img
                class="security-image"
                src="imgs/imagemUltima.png"
                alt="Ilustracao de seguranca em camadas da ControlCenter"
                loading="lazy"
                decoding="async"
            >

        </div>'''

html = html[:start] + replacement + html[end:]

marker_a = "/* SECURITY IMAGE OVERRIDE START */"
marker_b = "/* SECURITY IMAGE OVERRIDE END */"
if marker_a in html and marker_b in html:
    a = html.index(marker_a)
    b = html.index(marker_b, a) + len(marker_b)
    html = html[:a] + html[b:]

css = '''

        /* SECURITY IMAGE OVERRIDE START */
        .security-visual {
            min-height: 570px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            overflow: visible;
        }

        .security-image {
            width: min(100%, 560px);
            max-width: 100%;
            height: auto;
            object-fit: contain;
            background: transparent;
            border: 0;
            box-shadow: none;
            transform: none;
        }

        @media (max-width: 850px) {
            .security-visual { min-height: 430px; }
            .security-image { width: min(100%, 500px); }
        }

        @media (max-width: 600px) {
            .security-visual { min-height: 340px; }
            .security-image { width: min(100%, 420px); }
        }
        /* SECURITY IMAGE OVERRIDE END */
'''

html = html.replace("    </style>", css + "\n    </style>", 1)
path.write_text(html, encoding="utf-8")
