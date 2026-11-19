# LUSM - Sorte

Roleta de sorteio honesta, feita em **TypeScript** com **Vite**. Cada nome ocupa uma fatia, o sorteado continua na roleta e o resultado é escolhido por um gerador criptográfico.

## Como rodar

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo.

```bash
npm install
npm run dev       # abre em http://localhost:5173
```

Outros comandos:

```bash
npm run build     # verifica os tipos e gera a versão final em dist/
npm run preview   # serve a pasta dist/ para conferir o build
npm test          # roda os testes de honestidade do sorteio
```

A pasta `dist/` gerada pelo build pode ser publicada em qualquer hospedagem estática (GitHub Pages, Netlify, Vercel…).

## Publicar na Vercel

O projeto já vem configurado (`vercel.json`). Tem dois jeitos:

**Pelo GitHub (recomendado, atualiza sozinho a cada push)**

1. Suba esta pasta para um repositório no GitHub.
2. Entre em [vercel.com/new](https://vercel.com/new), clique em **Import** no repositório.
3. A Vercel detecta tudo sozinha (Vite, `npm run build`, pasta `dist`). É só clicar em **Deploy**.

**Pelo terminal**

```bash
npm i -g vercel
vercel          # primeira vez: faz login e cria o projeto (prévia)
vercel --prod   # publica no endereço oficial
```

## Como o sorteio é honesto

1. Ao clicar em **GIRAR**, o vencedor é escolhido **antes** da animação, com `crypto.getRandomValues` e amostragem por rejeição. Cada nome tem exatamente a mesma chance (1 em N).
2. A roleta calcula quantas voltas dar para parar num ponto aleatório **dentro** da fatia sorteada, longe das bordas, sem empate visual.
3. O sorteado continua na roleta e ganha um selo de vitórias ao lado do nome (passe o mouse para ver a %); para tirar alguém, clique no × ao lado do nome.
4. Nomes repetidos (mesmo com maiúsculas ou espaços diferentes) são aceitos, mas a roleta avisa: cada repetição é uma fatia a mais e, portanto, mais chance de ganhar. Só a cópia mais nova pede confirmação: clique no ícone de alerta para manter. Cada item tem seu próprio selo de vitórias.
5. Qualquer nome pode ser editado pelo lápis ao lado dele (Enter salva, Esc cancela).
6. Cabem até 100 nomes (constante `MAX_NAMES` em `src/types.ts`); acima disso as fatias ficam finas demais para ler. O que passar do limite não é adicionado, e a roleta avisa quantos ficaram de fora.
7. Cada giro é gravado num vídeo curto (roleta girando + resultado). Na janela do vencedor aparece a prévia e o botão **Baixar vídeo** (MP4 quando o navegador suporta, senão WebM). Fechar a janela descarta o vídeo.
8. Nada é salvo no navegador: ao recarregar ou fechar a página, a lista e as vitórias começam do zero.

Os testes em `src/spin.test.ts` confirmam que a roleta sempre para no nome sorteado e que a distribuição é uniforme.

## Estrutura

```
index.html          página
public/             favicons
src/
  assets/           ponteiro e ícones em SVG
  main.ts           interface: lista, botões, giro, resultado
  recorder.ts       grava o vídeo do giro (canvas + MediaRecorder)
  text.ts           limpeza, comparação e corte de nomes
  stats.ts          contagem de vitórias por nome
  icons.ts          carrega os ícones SVG nos botões
  wheel.ts          desenho da roleta no canvas
  spin.ts           matemática do giro (sorteio → ângulo final)
  random.ts         aleatoriedade criptográfica e embaralhamento
  confetti.ts       animação de confete
  types.ts          tipos e cores
  style.css         visual
  *.test.ts         testes
```

## Imagens

- `public/favicon.ico`, `public/favicon.svg`: ícone da aba do navegador
- `src/assets/pointer.svg`: ponteiro da roleta
- `src/assets/icons/`: ícones dos botões, do troféu, da coroa das vitórias e do trevo (SVG)

---

© LUSM - Lucas Silva Massaroto
