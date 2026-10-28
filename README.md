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

## Controles

### Geral
| Tecla | Ação |
|---|---|
| ENTER | Iniciar modo de treino (na tela de título) |
| ESC | Voltar para o menu principal |
| ENTER (após K.O.) | Reiniciar a luta |
| F1 | Liga/desliga debug: estado, frames do golpe, hp, hurtbox (verde), pushbox (azul) e hitbox (vermelha, só nos frames *active*) |

### Jogador 1 (Saci)
| Tecla | Ação |
|---|---|
| W / S | Pular / agachar |
| A / D | Andar para esquerda / direita |
| F | Soco |
| G | Chute |
| H | Defesa (segurar) |

### Jogador 2 (Curupira / boneco de treino)
| Tecla | Ação |
|---|---|
| Setas | Andar, pular (cima), agachar (baixo) |
| J (ou Num 1) | Soco |
| K (ou Num 2) | Chute |
| L (ou Num 3) | Defesa (segurar) |

Golpes mudam com a posição: em pé, **agachado** (segurando ↓) e **no ar** (durante o pulo). O chute agachado derruba (rasteira).

Cada lutador tem uma barra de vida no topo da tela (Saci 90, Curupira 110). Ao zerar, o lutador cai, fica no chão (K.O.) e os controles travam. Dano em defesa (chip) nunca nocauteia.

## Sprites: trocar placeholders por PNG

Sem arte, o jogo gera placeholders. Para usar arte real, coloque o PNG no caminho certo e recarregue a página:

```
assets/characters/<personagem>/<estado>.png    (ex.: assets/characters/saci/idle.png)
assets/characters/<personagem>/<estado>.json   (opcional)
```

- Spritesheet **horizontal**, frames de **128×128**, pivô padrão nos pés `(64, 124)`.
- Sem JSON, o número de frames é `largura / 128`.
- JSON opcional: `{ "frameWidth": 128, "frameHeight": 128, "frames": 6, "fps": 12, "loop": true, "pivot": { "x": 64, "y": 124 } }`
- Exemplo pronto: `assets/_exemplo/idle_exemplo.png` (2 frames).

> Os erros **404** no console para arquivos em `assets/` são esperados: indicam que o jogo procurou o PNG, não achou e usou o placeholder.
