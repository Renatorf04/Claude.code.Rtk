# Nós Dois 💌

Um jogo de casal para reconectar — feito para rodar **no celular, offline, sem instalar nada**.

Tudo cabe em um único arquivo: [`index.html`](index.html). Sem internet, sem conta,
sem servidor. O que vocês responderem não sai do aparelho.

---

## O que tem dentro

**260 cartas**, escritas em português, divididas em dois modos e três climas:

| Modo | Leve 🌤️ | Íntimo 🕯️ | Picante 🔥 |
|---|---|---|---|
| Cartas de Conexão | 40 | 40 | 30 |
| Verdade | 25 | 25 | 25 |
| Desafio | 25 | 25 | 25 |

- **Cartas de Conexão** — perguntas para conversar de verdade. O jogo alterna quem responde.
- **Verdade ou Desafio** — cada um escolhe (ou sorteia), com placar simples.
- **Clima** — dá para combinar os três. O picante começa **desligado** e só liga com confirmação.
- **♥ Salvar** — guarda as cartas que valeram a pena para reler depois.
- **Sem repetição** — o baralho é embaralhado e nenhuma carta se repete até acabar. O progresso fica salvo mesmo se fechar o app.

## Como colocar no celular

### Android
1. Baixe o `index.html` no celular (por WhatsApp, e-mail, Drive ou direto deste repositório).
2. Abra o app **Arquivos** → pasta **Download** → toque no `index.html` → escolha abrir com o **Chrome**.
3. No Chrome, menu ⋮ → **Adicionar à tela inicial** para virar um ícone.

### iPhone
1. Salve o `index.html` no app **Arquivos** (em "No meu iPhone").
2. Toque no arquivo para abrir. O Safari abre o jogo normalmente e ele funciona offline.
3. O iOS não cria atalho na tela de início a partir de arquivo local. Se o ícone na tela
   for importante, a alternativa é publicar a página (GitHub Pages, por exemplo) e usar
   **Compartilhar → Adicionar à Tela de Início** — aí sim vira um app com ícone.

> Em qualquer um dos casos o jogo funciona **sem internet**. Nada é enviado para lugar nenhum.

## Como jogar

1. Coloquem os nomes de vocês dois na tela inicial.
2. Escolham o modo e o clima da noite.
3. Deixem o celular no meio dos dois e revezem.
4. Passar é sempre permitido — e também diz alguma coisa.

## Como mudar ou acrescentar cartas

Abra o `index.html` em qualquer editor de texto e procure por `const CARTAS`.
As frases estão em listas simples, separadas por modo e clima:

```js
conexao: {
  leve: [
    'Qual foi a primeira coisa que você reparou em mim?',
    // acrescente uma frase nova aqui, entre aspas e com vírgula no fim
  ],
```

Nas cartas de **desafio**, escreva `{p}` onde deve aparecer o nome de quem **não** está
cumprindo o desafio. Exemplo: `'Faça carinho no cabelo de {p} por 1 minuto.'`

Depois de editar, é só salvar o arquivo e abrir de novo no celular.

## Dados guardados

Nomes, placar, cartas salvas e o progresso do baralho ficam no `localStorage` do próprio
navegador do celular. Para zerar tudo, basta limpar os dados do site no navegador.
