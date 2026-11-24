# Transforma as descrições dos pratos (src/lib/scan/pratos.ts) em vetores do modelo de visão.
# Uso: node --experimental-strip-types tools/clip/prompts.mts frases.json && python rotulos.py frases.json pesos.pth saida.json
# Pesos: OpenCLIP ViT-B-32 laion2b_e16 (github.com/mlfoundations/open_clip/releases/download/v0.2-weights/vit_b_32-laion2b_e16-af8dbd0c.pth)
import sys, json, base64, numpy as np, torch, open_clip
torch.set_grad_enabled(False)
frases = json.load(open(sys.argv[1]))
model, _, _ = open_clip.create_model_and_transforms('ViT-B-32', pretrained=sys.argv[2])
tok = open_clip.get_tokenizer('ViT-B-32')
model.eval()

def tabela(items):
    ids, vecs = [], []
    for it in items:
        e = model.encode_text(tok(it['frases'])).float()
        e = e / e.norm(dim=-1, keepdim=True)
        m = e.mean(0)
        vecs.append((m / m.norm()).numpy())
        ids.append(it['id'])
    v = np.stack(vecs)
    esc = np.abs(v).max(1) / 127.0
    q = np.round(v / esc[:, None]).astype(np.int8)
    back = q * esc[:, None]
    cos = (back * v).sum(1) / np.linalg.norm(back, axis=1)
    print(len(ids), 'vetores, pior fidelidade', float(cos.min()))
    return {'ids': ids, 'escala': [float(x) for x in esc], 'vetores': base64.b64encode(q.tobytes()).decode()}

out = {'modelo': 'OpenCLIP ViT-B-32 laion2b_e16', 'dim': 512, 'logit': float(model.logit_scale.exp()), 'pratos': tabela(frases['pratos']), 'partes': tabela(frases['partes'])}
json.dump(out, open(sys.argv[3], 'w'))
