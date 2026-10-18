# Antropofágico Combat

Protótipo de jogo de luta 2D em pixel art, no navegador, com personagens do folclore brasileiro.
Veja o roadmap e as decisões em [plano.md](plano.md).

## Como rodar

O jogo usa módulos ES, que **não funcionam** abrindo o `index.html` direto (`file://`).
Sirva a pasta com um servidor estático:

```bash
python -m http.server 8000
```

Depois abra <http://localhost:8000>.

(Alternativa, se tiver Node.js: `npx serve`.)

## Controles (Etapa 1)

| Tecla | Ação |
|---|---|
| ENTER | Confirmar (por enquanto só mostra um aviso) |
| F1 | Liga/desliga o modo debug (ticks/s, fps, estado, frame) |
