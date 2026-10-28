# ANTROPOFÁGICO COMBAT — PLANO.md

Protótipo de jogo de luta 2D lateral, no navegador, com folclore brasileiro e pixel art moderno.
Inspiração mecânica: Mortal Kombat 2 (luta lateral, especiais por sequência de botões). Tudo é original: nenhum personagem, nome, sprite ou asset do MK.

> Antropofagia: devorar a influência de fora e digerir em algo brasileiro.

**Como usar este arquivo:** o Claude Code deve ler este plano, esperar aprovação, e executar UMA etapa por vez, marcando os checklists, testando e aguardando "ok" antes de seguir.

---

## 1. Visão geral e escopo

### Entra no protótipo
- 2 personagens jogáveis: **Saci** e **Curupira**.
- 1 cenário: **Mata Atlântica** (parallax em camadas, cachoeira, folhagem).
- Modos: **P1 vs P2** (local) e **P1 vs CPU** (IA simples).
- Rounds melhor de 3, timer de 60 s, barras de vida, telas de round e vitória, pausa.
- 4 golpes especiais (2 por personagem), com input por sequência.
- Pipeline de pixel art: resolução interna fixa, sprites orientados a dados, placeholders que viram sprites reais só colocando PNGs na pasta certa.
- Efeitos: partículas, glow, flash de dano, hitstop, tremor de tela.
- Modo debug (hitboxes, estados, inputs).

### Fica de fora (explicitamente)
- Áudio e música (apenas ganchos no código).
- Online/multiplayer em rede.
- Mais de 2 personagens e mais de 1 cenário.
- Combos encadeados complexos, super/ultimate, fatalities.
- Controles de toque (celular).
- Menu de opções, salvamento, ranking.
- Arte final (será feita depois, no Aseprite ou por artista).

---

## 2. Estrutura de pastas e arquivos

```
antropofagico-combat/
├── index.html                 # canvas, título, carrega src/main.js
├── PLANO.md                   # este arquivo (checklists atualizados)
├── README.md                  # como rodar, controles, como adicionar conteúdo
├── src/
│   ├── main.js                # bootstrap: cria Game, inicia o loop
│   ├── config.js              # TODAS as constantes de balanceamento e resolução
│   ├── palette.js             # paleta central de cores
│   ├── core/
│   │   ├── game.js            # máquina de estados do jogo (menu, seleção, luta, pausa...)
│   │   ├── loop.js            # game loop com passo fixo de 60 FPS (acumulador)
│   │   ├── renderer.js        # canvas offscreen 480x270 + ampliação com escala inteira
│   │   ├── input.js           # teclado + gamepad -> ações lógicas por frame
│   │   ├── inputBuffer.js     # histórico de inputs e reconhecimento de sequências
│   │   ├── camera.js          # câmera segue o ponto médio dos lutadores
│   │   └── assets.js          # carregador de PNG/JSON com fallback para placeholder
│   ├── fight/
│   │   ├── fighter.js         # entidade lutador + máquina de estados
│   │   ├── moves.js           # execução de golpes (startup/active/recovery)
│   │   ├── collision.js       # AABB: hitbox, hurtbox, pushbox
│   │   ├── projectile.js      # projéteis (Fogo do Cabelo)
│   │   ├── round.js           # lógica de rounds, timer, KO, vitória
│   │   └── ai.js              # IA simples
│   ├── characters/
│   │   ├── saci.js            # configuração de dados do Saci
│   │   └── curupira.js        # configuração de dados do Curupira
│   ├── stages/
│   │   └── mataAtlantica.js   # camadas de parallax + partículas do cenário
│   ├── render/
│   │   ├── sprites.js         # animação por spritesheet e pivôs
│   │   ├── placeholders.js    # gera sprites/camadas procedurais
│   │   ├── fx.js              # partículas, glow, flash, tremor
│   │   └── hud.js             # barras de vida, timer, textos de round
│   └── debug/
│       └── debugOverlay.js    # F1: hitboxes, estados, últimos inputs
├── assets/
│   ├── characters/<personagem>/<estado>.png (+ <estado>.json opcional)
│   ├── stages/<cenario>/<camada>.png
│   └── fx/
└── tests/
    ├── round.test.mjs         # testes de rounds, timer e placar (node:test)
    ├── inputBuffer.test.mjs   # testes do reconhecimento de sequências (node:test)
    └── e2e.mjs                # teste E2E em navegador headless via CDP
```

**Responsabilidades-chave**
- `config.js` é a única fonte de números de balanceamento.
- Personagens são **dados** (`characters/*.js`); o código de `fighter.js` e `moves.js` é genérico.
- `assets.js` tenta carregar cada PNG; se não existir, usa o placeholder de `placeholders.js`, sem mudar código.

---

## 3. Arquitetura

### 3.1 Game loop (passo fixo 60 FPS)
- `requestAnimationFrame` + acumulador de tempo: a lógica roda em passos de `1/60 s`, o render roda uma vez por frame do navegador.
- Limite de passos por frame (ex.: 5) para evitar "espiral da morte" após a aba ficar em segundo plano.
- A lógica é **determinística** (sem `Math.random()` solto: usar um RNG com seed em `config`/`game`), o que facilita testes e futuros replays.

### 3.2 Máquina de estados do jogo
`TITLE → CHAR_SELECT → ROUND_INTRO → FIGHTING → ROUND_END → (ROUND_INTRO | MATCH_END) → TITLE`
Com `PAUSED` acessível a partir de `FIGHTING` (ESC).

### 3.3 Máquina de estados do lutador
Estados: `idle`, `walk_fwd`, `walk_back`, `jump`, `crouch`, `block`, `attack`, `hitstun`, `knockdown`, `victory`.
- Cada estado define: animação, se aceita input, se pode ser cancelado, transições permitidas.
- `attack` guarda o golpe atual e o frame (startup → active → recovery).
- `hitstun` e `block` têm duração (stun) definida pelo golpe que acertou.
- O lutador sempre vira para o oponente (exceto durante pulo/ataque já iniciado).

### 3.4 Sistema de input
- Teclado (e gamepad opcional) é convertido em **ações lógicas** por frame: `left, right, up, down, punch, kick, block`.
- A direção é guardada de forma **relativa ao lado do lutador**: `forward` / `back`, de modo que a sequência ↓ → funcione dos dois lados da tela.
- `inputBuffer.js` mantém um histórico (ex.: últimos 30 frames) com direções e botões carimbados por frame.
- Sequências são descritas como dados, por exemplo `{ seq: ['down', 'forward', 'punch'], window: 20 }`: reconhece se os passos ocorrem em ordem dentro da janela (em frames), tolerando 1–2 frames de ruído.
- Prioridade: especial > golpe básico; golpe mais específico vence o mais genérico.

### 3.5 Hitbox / Hurtbox / Pushbox
- Tudo em **AABB** (retângulos), em coordenadas locais relativas ao pivô do lutador, espelhadas conforme a direção.
- **Hurtbox:** onde o lutador pode ser acertado (muda com agachar/pular).
- **Hitbox:** ativa apenas nos frames *active* do golpe; um golpe acerta **uma vez** por execução.
- **Pushbox:** impede que os lutadores se atravessem.
- No acerto: dano, **hitstop** (congela ambos por 4–6 frames), knockback e stun. Com defesa: dano reduzido (chip), knockback menor, blockstun.

### 3.6 Pipeline de render (pixel art)
- Tudo é desenhado num canvas offscreen de **480×270**.
- Ampliação para a tela com **escala inteira** (`floor(min(w/480, h/270))`), centralizado com barras; `imageSmoothingEnabled = false` e CSS `image-rendering: pixelated`.
- Ordem de desenho: camadas de fundo → sombras → lutadores/projéteis → camadas de frente → partículas/glow → HUD.
- Glow aditivo com `globalCompositeOperation = 'lighter'`.
- Tremor de tela e flash aplicados no passo de ampliação, sem alterar a lógica.

### 3.7 Sprites e animação (orientado a dados)
- Cada estado do personagem: spritesheet horizontal `<estado>.png` + metadados (`frames`, `fps`, `loop`, `pivot`, tamanho do frame).
- Exemplo de JSON de animação:

```json
{
  "frameWidth": 128,
  "frameHeight": 128,
  "frames": 6,
  "fps": 12,
  "loop": false,
  "pivot": { "x": 64, "y": 124 }
}
```

- Frame data dos golpes mora no arquivo do personagem (`startup`, `active`, `recovery`, hitbox, dano, stun, knockback).
- **Placeholders** têm o mesmo tamanho dos sprites finais: silhueta colorida por personagem, com nome do estado e nº do frame escritos.

### 3.8 IA
- IA reativa simples, com decisão a cada N frames: aproxima se longe, ataca se na distância do golpe, defende se o oponente está atacando, usa especial de vez em quando (com cooldown).
- Dificuldade controlada por 2–3 parâmetros em `config.js` (tempo de reação, agressividade, chance de defesa).

---

## 4. Decisões técnicas e justificativas

| Decisão | Justificativa | Alternativas descartadas |
|---|---|---|
| JS puro + ES modules, sem build | Zero fricção, roda com servidor estático, fácil de depurar e de publicar | Phaser/PixiJS (mais rápidos de começar, mas escondem a lógica de luta que queremos controlar); TypeScript+Vite (bom depois, excesso agora) |
| Canvas 2D | Suficiente para 480×270 em pixel art, simples | WebGL (só se precisarmos de shaders/iluminação avançada depois) |
| Resolução interna 480×270, escala inteira | Pixels nítidos e consistentes, 16:9, múltiplos de 1080p (×4) | Resolução livre (pixels irregulares) |
| Passo fixo 60 FPS | Física e frame data consistentes em qualquer monitor | Delta time variável (dá inconsistência em hitboxes e frame data) |
| AABB para colisão | Padrão em jogos de luta 2D, barato e previsível | Colisão por pixel (caro e desnecessário) |
| Lutadores como dados | Adicionar personagem = adicionar um arquivo | Classes por personagem (duplicação) |
| Input relativo ao lado (forward/back) | Sequências funcionam espelhadas sem código extra | Sequências absolutas ←/→ |
| Placeholders procedurais com fallback | Dá para jogar e balancear sem arte; troca de arte sem tocar no código | Esperar a arte |
| RNG com seed | Determinismo para testes e replays futuros | `Math.random()` direto |
| `node:test` para o input buffer | Sem dependências, cobre a parte mais frágil | Sem testes |
| Servidor local via `python -m http.server` | Python já disponível; Node (v26 LTS) instalado na Etapa 6 para os testes | `npx serve` (requer Node) |
| Fonte "Press Start 2P" (Google Fonts) com fallback `monospace` e timeout de 1,5 s | Visual pixel imediato sem desenhar fonte bitmap; não bloqueia o boot offline | Fonte bitmap própria (pode vir na Etapa 10) |
| `render/sprites.js` antecipado para a Etapa 2; placeholders gerados também pré-espelhados | Necessário para exibir o sprite de teste; o texto do placeholder não sai invertido quando o lutador olha para a esquerda | Espelhar tudo via `scale(-1,1)` (texto ilegível) |
| Estados modulares em `src/states/` e enum em `src/core/gameState.js` | Evita dependência circular e mantém game.js enxuto conforme novos estados forem adicionados | Tudo concentrado em game.js |
| Frame data dos golpes básicos em `config.js` (`BASIC_MOVES`), com sobrescrita opcional por personagem (`moves` em `characters/*.js`) | Segue a regra "balanceamento só em config.js" e a tabela da seção 6; especiais (Etapa 7) entram nos arquivos dos personagens | Frame data só nos arquivos dos personagens (espalharia números) |
| Defesa bloqueia qualquer golpe (sem guarda alta/baixa) e só no chão | Mantém o escopo simples do protótipo; guarda alta/baixa seria um sistema extra | Guarda alta/baixa (fora do escopo) |
| Pushbox só no chão; no canto, quem não está encurralado absorve todo o empurrão | Permite pular por cima do oponente e evita lutadores presos um dentro do outro nos cantos | Pushbox também no ar (impede cruzar pulando) |
| Dano de defesa (chip) nunca causa KO | Evita vitória "barata" por chip | KO por chip |
| Fases do round (`ROUND_INTRO`, `ROUND_END`, `MATCH_END`) vivem dentro de `FIGHTING`, em `fight/round.js` (classe `Match`, sem DOM); `PAUSED` é um estado do jogo que retoma com `setState(FIGHTING, { resume: true })` | Lutadores, câmera e HUD continuam vivos entre as fases sem passar objetos entre estados; a lógica de rounds fica pura e testável com `node:test` | Um estado do jogo por fase (exigiria compartilhar a partida entre 4 estados) |
| Tempo esgotado decide por **porcentagem** de vida; empate (vida igual ou duplo K.O.) não pontua, com limite de `MAX_ROUNDS = 5` (depois decide pelo placar ou empata a partida) | Saci (90) e Curupira (110) têm vidas máximas diferentes; o limite evita partida infinita | Vida absoluta (favorece o Curupira); empate dando ponto aos dois |
| Teste E2E (`tests/e2e.mjs`) dirige Edge/Chrome headless pelo DevTools Protocol com o `WebSocket` nativo do Node, sem dependências; desliga o loop e avança ticks manualmente | Testa a partida completa no navegador real, de forma determinística, sem `npm install` | Puppeteer/Playwright (dependências pesadas) |

Observação: módulos ES não funcionam abrindo `index.html` direto (`file://`); usar `npx serve` ou `python -m http.server`.

---

## 5. Roadmap em etapas

Regras para **todas** as etapas: rodar e testar no navegador, atualizar os checklists deste arquivo, relatar o que foi testado e esperar "ok".

### Etapa 1 — Esqueleto
**Objetivo:** projeto roda, loop estável, tela inicial com o nome.
- [x] `index.html` com título "Antropofágico Combat" e canvas
- [x] `main.js`, `core/loop.js` (passo fixo), `core/game.js` (estado `TITLE`)
- [x] `config.js` com resolução e FPS
- [x] Tela inicial com o nome do jogo e "Pressione ENTER"
- [x] README mínimo com como rodar

**Arquivos:** `index.html`, `src/main.js`, `src/core/loop.js`, `src/core/game.js`, `src/config.js`, `README.md`
**Aceite:** ao abrir `localhost`, vê o título e o canvas; contador de FPS/ticks em debug mostra ~60 passos/s; trocar de aba e voltar não trava nem acelera o jogo.
**Riscos:** módulos ES bloqueados em `file://` (documentar no README).

### Etapa 2 — Pipeline de pixel art
**Objetivo:** render offscreen 480×270, escala inteira, loader com fallback.
- [x] `core/renderer.js` com canvas offscreen e ampliação com escala inteira e barras
- [x] Redimensionar a janela mantém pixels nítidos e proporção
- [x] `core/assets.js` carrega PNG/JSON; falha cai no placeholder
- [x] `render/placeholders.js` gera um sprite de teste com texto
- [x] `palette.js` inicial

**Arquivos:** `core/renderer.js`, `core/assets.js`, `render/placeholders.js`, `palette.js`
**Aceite:** um sprite placeholder aparece nítido; ao redimensionar a janela, a escala muda só em múltiplos inteiros; se eu colocar um PNG com o nome certo em `assets/`, ele substitui o placeholder após recarregar.
**Riscos:** borrão por subpixel (usar posições inteiras ao desenhar); `devicePixelRatio` em telas HiDPI.

### Etapa 3 — Um lutador (placeholder)
**Objetivo:** andar, pular, agachar e virar para o oponente.
- [x] `core/input.js` (teclado P1 e P2, ações lógicas)
- [x] `fight/fighter.js` com estados `idle`, `walk_*`, `jump`, `crouch`
- [x] Gravidade, chão, limites do cenário
- [x] Um "boneco de treino" parado para o lutador virar para ele
- [x] `core/camera.js` básica

**Arquivos:** `core/input.js`, `fight/fighter.js`, `core/camera.js`, `characters/saci.js` (parcial)
**Aceite:** o Saci anda, pula (altura/duração conforme config), agacha e sempre fica de frente para o boneco; não sai do cenário.
**Riscos:** troca de lado durante o pulo (travar direção até pousar).

### Etapa 4 — Golpes básicos e colisão
**Objetivo:** soco, chute e defesa com frame data e hitboxes; debug.
- [x] `fight/moves.js` (startup/active/recovery) e `fight/collision.js`
- [x] Soco e chute em pé, agachado e no ar
- [x] Defesa
- [x] Hitstop, knockback, hitstun, blockstun
- [x] `debug/debugOverlay.js` (F1): hitboxes, hurtboxes, estado, frame, inputs

**Arquivos:** `fight/moves.js`, `fight/collision.js`, `debug/debugOverlay.js`, `config.js`
**Aceite:** com F1 ligado, vejo hitbox (vermelho) só nos frames *active* e hurtbox (verde); acertar o boneco gera hitstop, empurrão e tremor; um golpe acerta uma única vez por execução.
**Riscos:** golpes "atravessando" em velocidade alta (limitar velocidade ou varrer a hitbox); hitbox espelhada errada ao virar.

### Etapa 5 — Dois lutadores, dano e vida
**Objetivo:** Saci vs Curupira, vida e KO.
- [x] `characters/curupira.js` com dados básicos
- [x] Pushbox (um não atravessa o outro)
- [x] Dano, barras de vida (HUD), KO e animação de queda
- [x] `render/hud.js`

**Arquivos:** `characters/curupira.js`, `render/hud.js`, `fight/fighter.js`, `fight/collision.js`
**Aceite:** dois jogadores humanos lutam; a vida cai conforme o dano; ao zerar, o lutador cai (`knockdown`) e os controles travam.
**Riscos:** lutadores presos um dentro do outro nos cantos (resolver empurrando com prioridade).

### Etapa 6 — Rounds, timer e telas
**Objetivo:** partida completa melhor de 3.
- [x] `fight/round.js` (timer de 60 s, KO, tempo esgotado, vitória por vida)
- [x] Telas "ROUND 1 / FIGHT!", "K.O." e vitória
- [x] Pausa com ESC
- [x] Reinício de round (posições, vida, estados)

**Arquivos:** `fight/round.js`, `core/game.js`, `render/hud.js`
**Aceite:** jogo flui do início ao fim de uma partida, com placar de rounds; o timer acaba e decide por vida restante; ESC pausa e retoma sem perder estado.
**Riscos:** estado "vazando" entre rounds (resetar tudo de forma explícita).

### Etapa 7 — Input buffer e especiais
**Objetivo:** os 4 especiais funcionando.
- [ ] `core/inputBuffer.js` com histórico e reconhecimento de sequências
- [ ] `tests/inputBuffer.test.mjs` cobrindo ↓→ P, ↓← K, espelhamento, janela e ruído
- [ ] Saci: **Redemoinho** (↓ → + soco) e **Sumiço** (↓ ← + chute)
- [ ] Curupira: **Fogo do Cabelo** (↓ → + soco, com `fight/projectile.js`) e **Pegada Invertida** (↓ ← + chute)
- [ ] Debug mostra o buffer e o especial reconhecido

**Arquivos:** `core/inputBuffer.js`, `fight/projectile.js`, `fight/moves.js`, `characters/*.js`, `tests/inputBuffer.test.mjs`
**Aceite:** `node --test tests/` passa; em jogo, cada especial sai de forma consistente dos dois lados da tela; especiais têm recuperação e custo de risco (punível se errar).
**Riscos:** sequência impossível/impreciosa (janela configurável; plano B: janela maior e 1 frame de tolerância); conflito entre especial e golpe básico (prioridade explícita).

### Etapa 8 — Cenário Mata Atlântica
**Objetivo:** cenário vivo com parallax e atmosfera.
- [ ] `stages/mataAtlantica.js` com camadas: céu, montanhas, árvores distantes, cachoeira (animada), árvores próximas, folhagem em primeiro plano
- [ ] Parallax pela posição da câmera
- [ ] Partículas ambientes (folhas, vaga-lumes) e névoa
- [ ] Camadas substituíveis por PNG em `assets/stages/mataAtlantica/`
- [ ] Sombras sob os lutadores

**Arquivos:** `stages/mataAtlantica.js`, `render/fx.js`, `core/camera.js`
**Aceite:** ao lutadores se moverem, o fundo desliza em velocidades diferentes por camada; uma PNG colocada na pasta substitui a camada procedural.
**Riscos:** custo de desenho das camadas (pré-renderizar procedurais em canvas offscreen uma vez).

### Etapa 9 — IA para P1 vs CPU
**Objetivo:** dá para jogar sozinho.
- [ ] `fight/ai.js` (aproxima, ataca, defende, usa especial com cooldown)
- [ ] Opção na tela inicial: "1 JOGADOR" / "2 JOGADORES"
- [ ] Parâmetros de dificuldade em `config.js`

**Arquivos:** `fight/ai.js`, `core/game.js`, `config.js`
**Aceite:** a CPU luta de forma plausível, não é nem inofensiva nem imbatível; a IA usa o mesmo sistema de input/ações do jogador (sem "trapacear").
**Riscos:** IA que repete padrão (adicionar variação com RNG com seed).

### Etapa 10 — Efeitos, seleção e polimento
**Objetivo:** sensação de impacto e experiência completa.
- [ ] Faíscas, flash de dano, tremor de tela proporcional ao dano, glow no fogo
- [ ] Seleção de personagem simples (Saci / Curupira)
- [ ] Gamepad via Gamepad API (se simples)
- [ ] Ajuste fino de balanceamento via `config.js`
- [ ] Ganchos de áudio (sem sons ainda)

**Arquivos:** `render/fx.js`, `core/game.js`, `core/input.js`, `config.js`
**Aceite:** golpes "pesam"; seleção de personagem funciona; jogo estável a 60 FPS num notebook comum.
**Riscos:** excesso de partículas derrubando FPS (limitar e reciclar partículas).

### Etapa 11 — Revisão final
**Objetivo:** entregar o protótipo limpo e documentado.
- [ ] Revisão e limpeza do código
- [ ] README completo (rodar, controles, adicionar personagem/golpe, trocar placeholders por sprites com tamanhos, nomes de arquivo e formato do JSON)
- [ ] Atualizar este PLANO.md com o status final
- [ ] Lista do que ficou de fora e próximos passos

**Aceite:** alguém novo consegue rodar, jogar uma partida e adicionar um personagem seguindo só o README.
**Próximos passos sugeridos:** Iara, Boitatá, Mapinguari e Cuca; cenários Amazônia, Pantanal, Caatinga e Cerrado; sprites reais; sons; controles de toque; publicação no itch.io ou GitHub Pages.

---

## 6. Parâmetros de balanceamento (todos em `config.js`)

Valores iniciais de partida, para ajustar jogando (unidades: pixels da resolução interna e frames a 60 FPS).

**Mundo**
- `INTERNAL_WIDTH = 480`, `INTERNAL_HEIGHT = 270`, `FPS = 60`
- `STAGE_WIDTH = 960` (câmera percorre o cenário), `GROUND_Y = 230`
- `GRAVITY = 0.55`, `HITSTOP_FRAMES = 5`, `INPUT_WINDOW = 20`, `INPUT_BUFFER_FRAMES = 30`

**Round**
- `ROUND_TIME = 60` s, `ROUNDS_TO_WIN = 2`, `ROUND_INTRO_FRAMES = 120`, `KO_SLOWMO_FRAMES = 60`

**Por personagem**

| Parâmetro | Saci | Curupira |
|---|---|---|
| `maxHealth` | 90 | 110 |
| `walkSpeed` (px/frame) | 2.6 | 2.1 |
| `jumpVelocity` | -9.5 | -8.8 |
| `height` (px) | 100 | 112 |

**Golpes básicos (ponto de partida)**

| Golpe | Startup | Active | Recovery | Dano | Hitstun | Blockstun |
|---|---|---|---|---|---|---|
| Soco | 4 | 3 | 8 | 6 | 14 | 9 |
| Chute | 6 | 3 | 12 | 9 | 18 | 11 |
| Soco agachado | 5 | 3 | 9 | 5 | 13 | 8 |
| Chute agachado (rasteira) | 7 | 3 | 14 | 7 | 20 (derruba) | 10 |
| Golpe aéreo | 5 | 6 | 6 | 8 | 16 | 10 |

**Especiais (ponto de partida)**

| Especial | Startup | Efeito | Dano | Recovery |
|---|---|---|---|---|
| Redemoinho (Saci) | 8 | Investida giratória ~90 px | 12 | 22 |
| Sumiço (Saci) | 12 | Reaparece atrás do oponente | 0 | 16 |
| Fogo do Cabelo (Curupira) | 14 | Projétil a 4 px/frame | 10 | 24 |
| Pegada Invertida (Curupira) | 10 | Desliza ~70 px e acerta à frente | 11 | 20 |

**Defesa**
- `BLOCK_DAMAGE_MULTIPLIER = 0.2`, `BLOCK_PUSHBACK = 3`, defesa só em pé/agachado no chão.

**IA**
- `AI_REACTION_FRAMES = 18`, `AI_AGGRESSION = 0.5`, `AI_BLOCK_CHANCE = 0.4`, `AI_SPECIAL_COOLDOWN = 240`

---

## 7. Riscos gerais e plano B

| Risco | Plano B |
|---|---|
| Input buffer impreciso ou "duro" demais | Aumentar `INPUT_WINDOW`, tolerar 1–2 frames de ruído, mostrar buffer no debug para calibrar; testes em `node:test` |
| Hitbox espelhada errada / golpe atravessa | Debug overlay; varrer a hitbox entre frames se necessário; testes visuais por etapa |
| Queda de FPS (partículas, camadas) | Pré-renderizar camadas, limitar partículas, reciclar objetos, reduzir glow |
| Pixels borrados / escala errada | Posições inteiras ao desenhar, escala inteira, `image-rendering: pixelated` |
| Frame data sem graça ("não pesa") | Ajustar hitstop, tremor e knockback antes de mexer no dano |
| Arte atrasa | O jogo já funciona com placeholders; arte entra incremental, personagem por personagem |
| Estado vazando entre rounds | Função única de reset, chamada explicitamente; teste manual repetido de 3 partidas |
| Escopo crescendo | Tudo fora do escopo da seção 1 vai para "próximos passos", sem exceção no protótipo |

---

## 8. Convenções de trabalho (para o Claude Code)

1. Uma etapa por vez; nenhuma etapa começa sem "ok" da anterior.
2. Cada etapa termina com: checklist atualizado aqui, resumo do que foi testado e como testar.
3. Números de balanceamento só em `config.js`; nada "mágico" espalhado no código.
4. Commits pequenos (se o projeto estiver num repositório git), um por etapa ou subtarefa.
5. Ao encontrar decisão ambígua, registrar a decisão em "Decisões técnicas" e seguir; só perguntar se a escolha bloqueia a etapa.
