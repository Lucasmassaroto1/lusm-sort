# LUSM - Sorte

Roleta de sorteio honesta, feita em **TypeScript** com **Vite**. Cada nome ocupa uma única fatia (sem nomes repetidos), o sorteado continua na roleta e o resultado é escolhido por um gerador criptográfico.

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

## Sorteio verificável (branch de teste)

Cada giro pode ser conferido por qualquer pessoa, sem precisar confiar em quem girou.

1. **Antes do giro**, a roleta mostra o *compromisso do próximo giro*: um hash SHA-256 de uma semente secreta + a lista de nomes (na ordem das fatias). Publique ou mostre esse hash antes de girar.
2. **Opcional:** depois que o compromisso aparece, alguém do público escolhe uma *palavra do público*. Ela entra no cálculo, então nem quem gira consegue escolher o resultado antes.
3. **Depois do giro**, a semente é revelada. O botão **Copiar prova** copia tudo (nomes, semente, compromisso, palavra e vencedor) em JSON.
4. **Para conferir:** clique em *Verificar um sorteio* no site (ou num resultado do histórico) ou, sem depender do site:

```bash
node scripts/verificar.mjs prova.json
```

O script refaz as contas com o `crypto` do Node, sem usar o código do site.

Como é calculado:
- compromisso = `SHA-256("lusm-v1|commit|" + semente + "|" + JSON(nomes))`
- vencedor = primeiros 4 bytes de `SHA-256("lusm-v1|draw|" + semente + "|" + JSON(nomes) + "|" + palavra + "|" + contador)`, com amostragem por rejeição (chance exatamente 1/n)

Qualquer mudança na lista (adicionar, remover, embaralhar) gera uma semente e um compromisso novos. Precisa de HTTPS ou localhost (Web Crypto).

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
3. O sorteado continua na roleta e fica registrado em **Resultados**; para tirar alguém, clique no × ao lado do nome.
4. Nomes repetidos (mesmo com maiúsculas ou espaços diferentes) não são aceitos.

Os testes em `src/spin.test.ts` confirmam que a roleta sempre para no nome sorteado e que a distribuição é uniforme.

## Estrutura

```
index.html          página
public/             favicons
src/
  assets/           ponteiro e ícones em SVG
  main.ts           interface: lista, botões, giro, resultado
  icons.ts          carrega os ícones SVG nos botões
  wheel.ts          desenho da roleta no canvas
  spin.ts           matemática do giro (sorteio → ângulo final)
  random.ts         aleatoriedade criptográfica e embaralhamento
  audio.ts          sons gerados com Web Audio
  confetti.ts       animação de confete
  storage.ts        salva nomes, resultados e som no navegador
  types.ts          tipos e cores
  style.css         visual
  spin.test.ts      testes
```

## Imagens

- `public/favicon.ico`, `public/favicon.svg`: ícone da aba do navegador
- `src/assets/pointer.svg`: ponteiro da roleta
- `src/assets/icons/`: ícones dos botões, do troféu, da coroa do pódio e do trevo (SVG)

---

© LUSM - Lucas Silva Massaroto
