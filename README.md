# 🕵️ Jogo do Impostor

App de **passa-e-joga** para jogar o jogo do impostor com 3 a 8 pessoas (pensado para 4) usando **um único celular**. Não precisa de internet, servidor, cadastro nem instalação.

## Como jogar

1. **Configuração** — digite os nomes, escolha as categorias de palavras e ajuste as opções.
2. **Revelação** — o celular passa de mão em mão. Cada jogador **segura o botão** para ver sua palavra em segredo e passa adiante.
   - Todos recebem a **mesma palavra**, menos o impostor, que recebe uma **palavra parecida** (ex.: o grupo recebe *praia*, o impostor recebe *piscina*).
   - Ninguém é avisado de que é o impostor — ele só descobre quando o grupo aponta o dedo.
3. **Dicas** — na ordem de fala sorteada, cada um diz **uma única palavra** relacionada à sua. Nada de repetir dica já dita.
4. **Discussão** — com cronômetro opcional, todo mundo debate quem está destoando.
5. **Votação** — o celular passa de novo e cada um vota em quem acha que é o impostor. Ninguém vota em si mesmo e os votos ficam escondidos até o fim.
6. **Resultado** — o app revela o impostor, as duas palavras, quem votou em quem e o placar acumulado.

## Regras de desempate e pontuação

- **Empate na votação** → uma revotação, restrita aos empatados. Empatou de novo, o impostor escapa.
- **Impostor descoberto** → +1 ponto para cada jogador comum.
- **Impostor escapa** → +2 pontos para o impostor.
- **Chute final** (opcional, ligado por padrão) → se for descoberto, o impostor escolhe entre 4 palavras; acertando a palavra do grupo, rouba a vitória e leva +2.

O placar acumula entre rodadas. **Nova rodada** mantém jogadores e pontos; **Encerrar partida** zera tudo.

## Como abrir

**No celular, direto do arquivo:** copie a pasta para o aparelho e abra o `index.html` — funciona offline.

**Servindo localmente (mesma rede do computador):**

```bash
python3 -m http.server 8000
# depois acesse http://<ip-do-computador>:8000 no celular
```

**Publicando no GitHub Pages:** em *Settings → Pages*, aponte para esta branch e a raiz (`/`). O app é 100% estático.

## Estrutura

| Arquivo | O que faz |
|---|---|
| `index.html` | Todas as telas do jogo, alternadas por classe CSS |
| `styles.css` | Tema escuro, layout mobile-first |
| `palavras.js` | Banco com 140 pares de palavras em 7 categorias |
| `app.js` | Máquina de estados, sorteios, votação, placar e persistência |

Sem build, sem dependências e sem ES modules — por isso funciona até abrindo o arquivo por `file://`. O progresso da rodada fica no `localStorage`, então um refresh acidental não perde o jogo.

## Adicionar palavras

Edite `palavras.js`. Cada categoria tem uma lista de pares `[palavra do grupo, palavra do impostor]`. Os dois termos precisam ser próximos o bastante para que uma dica sirva para os dois — é isso que mantém o impostor disfarçado.
