from pathlib import Path

css = Path('workspace/shared/portalEnterprise.css')
text = css.read_text()
text = text.replace('\\n.message-actions', '\n.message-actions', 1)
text += '\n.attachment-image-modal-head>.attachment-image-modal-tools{display:inline-flex;align-items:center;grid-auto-flow:column;gap:4px;margin-left:auto;padding:4px;border:1px solid #dbe4eb;border-radius:10px;background:#f6f9fc}.attachment-image-modal-tools button{color:#174f82;background:transparent}.attachment-image-modal-tools button:hover{background:#e8f1f8;color:#0e385f}.attachment-image-modal-tools [data-image-zoom-reset]{color:#344552}.attachment-image-modal-body:has(img[style*="scale(1.5"]),.attachment-image-modal-body:has(img[style*="scale(2"]),.attachment-image-modal-body:has(img[style*="scale(3"]),.attachment-image-modal-body:has(img[style*="scale(4"]){cursor:grab}'
css.write_text(text)

admin = Path('workspace/admin/assets/js/admin.js')
text = admin.read_text()
old = "$('#internalNote').value = '';\n        if (window.CCAttachments) {"
new = "$('#internalNote').value = '';\n        window.CCAttachments?.clearReplyTarget?.();\n        if (window.CCAttachments) {"
if old not in text:
    raise SystemExit('internal note pattern not found')
admin.write_text(text.replace(old, new, 1))

print('Polish applied')
