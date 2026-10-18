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
| F1 | Liga/desliga overlay de debug (ticks/s, fps, estado, coordenadas, câmera) |

### Jogador 1 (Saci)
| Tecla | Ação |
|---|---|
| W | Pular (vertical ou diagonal) |
| S | Agachar |
| A | Andar para esquerda |
| D | Andar para direita |

### Jogador 2 (Curupira / Boneco de treino)
| Tecla | Ação |
|---|---|
| Seta Cima | Pular |
| Seta Baixo | Agachar |
| Seta Esquerda | Andar para esquerda |
| Seta Direita | Andar para direita |

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
