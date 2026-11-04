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
| ENTER | Iniciar partida (na tela de título) / Confirmar no menu de pausa / Voltar ao título após vitória |
| ESC | Pausar / Retomar a partida |
| Setas / W, S (na pausa) | Navegar pelo menu de pausa (Continuar / Sair para o título) |
| F1 | Liga/desliga debug: estado, frames do golpe, hp, buffer de inputs, último especial, round/timer/placar, hurtbox (verde), pushbox (azul) e hitbox (vermelha, só nos frames *active*) |

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

### Golpes especiais (por sequência)
As direções (`→` frente / `←` trás) são **relativas ao lado para onde o lutador está olhando** — funcionam igual dos dois lados da tela:

| Personagem | Especial | Sequência | Efeito |
|---|---|---|---|
| **Saci** | **Redemoinho** | `↓` `→` + **Soco** | Investida giratória (~90 px) que derruba o oponente |
| **Saci** | **Sumiço** | `↓` `←` + **Chute** | Desaparece em um redemoinho e reaparece atrás do oponente |
| **Curupira** | **Fogo do Cabelo** | `↓` `→` + **Soco** | Dispara uma bola de fogo que atravessa a tela |
| **Curupira** | **Pegada Invertida** | `↓` `←` + **Chute** | Rasteira deslizante (~70 px) que derruba à frente |

Cada lutador tem uma barra de vida no topo da tela (Saci 90, Curupira 110). As partidas são **melhor de 3 rounds** (vence quem ganhar 2), com timer de **60 segundos** por round. Ao zerar a vida, o lutador cai em K.O. Se o tempo acabar, vence quem tiver maior porcentagem de vida restante. Dano em defesa (chip) nunca nocauteia.

## Testes

Com Node.js instalado:

```bash
node --test tests/      # testes unitários (rounds, timer, placar)
node tests/e2e.mjs      # teste end-to-end no navegador headless (gera screenshots em tests/output/)
```

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

### Camadas do cenário (Mata Atlântica)
Para substituir qualquer camada procedural por arte própria, coloque o PNG em:

```
assets/stages/mataAtlantica/<camada>.png
```

Camadas disponíveis (do fundo para a frente): `sky`, `mountains`, `far_trees`, `waterfall`, `near_trees`, `ground`, `foreground` (altura recomendada: `270 px`).

> Os erros **404** no console para arquivos em `assets/` são esperados: indicam que o jogo procurou o PNG, não achou e usou o placeholder.
