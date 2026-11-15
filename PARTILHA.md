# Partilha ao vivo: configurar o Firebase (uma vez, ~10 minutos)

O Quadro CEA é um site estático: não precisa de servidor nem de VPS. Para a partilha ao vivo, os browsers ligam-se directamente ao **Firebase Realtime Database**, que tem um plano gratuito (Spark) mais do que suficiente para uma turma:

- até **100 pessoas ligadas ao mesmo tempo**;
- **1 GB** de dados guardados e **10 GB/mês** de transferência.

Sem esta configuração o quadro funciona na mesma; só o botão **Partilhar** fica a avisar que falta configurar.

## 1. Criar o projecto
1. Abre <https://console.firebase.google.com> com uma conta Google.
2. **Adicionar projecto** → dá-lhe um nome (ex.: `quadro-cea`). O Google Analytics pode ficar desligado.

## 2. Activar o login anónimo
É assim que o quadro sabe que só tu podes escrever no teu quadro (sem pedir palavra-passe a ninguém).

1. Menu **Build → Authentication → Começar**.
2. Separador **Sign-in method** → **Anónimo** → **Activar** → Guardar.

## 3. Criar a base de dados e colar as regras
1. Menu **Build → Realtime Database → Criar base de dados**.
2. Localização: escolhe a mais próxima (ex.: Bélgica, `europe-west1`).
3. Começa em **modo bloqueado**.
4. Separador **Regras**: apaga o que lá está, cola o conteúdo do ficheiro `database.rules.json` (está nesta pasta) e carrega em **Publicar**.

As regras fazem isto:
- qualquer pessoa com o link **pode ver**;
- **só o browser que criou o quadro pode escrever** nele;
- quem acompanha só pode marcar que está a ver (o contador de pessoas).

## 4. Copiar a configuração para o projecto
1. Engrenagem ⚙ → **Definições do projecto** → em **As tuas apps**, carrega no ícone **Web** (`</>`) → regista a app (sem Hosting).
2. Aparece um bloco `firebaseConfig`. Copia estes valores.
3. Nesta pasta (`quadro-app`), copia `.env.example` para **`.env.local`** e preenche:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://....firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

> O `databaseURL` só aparece depois de criares a base de dados (passo 3). Se não estiver no bloco, copia-o do topo da página **Realtime Database**.
>
> Estes valores não são secretos (ficam no site público); a segurança está nas regras do passo 3.

## 5. Gerar o site e publicar
```
npm run build
```
Isto cria a pasta **`out/`**. Publica o conteúdo dessa pasta em qualquer alojamento de sites estáticos, por exemplo:
- **Netlify Drop**: <https://app.netlify.com/drop>, arrastas a pasta `out` e pronto;
- **GitHub Pages**, **Cloudflare Pages** ou **Firebase Hosting**.

Se o login anónimo der erro no site publicado, junta o domínio em **Authentication → Settings → Domínios autorizados**.

## Como usar na aula
1. No quadro, carrega em **Partilhar → Começar a partilhar**.
2. Copia o link e envia-o no chat do Teams ou no grupo do WhatsApp.
3. Os colegas vêem o quadro **ao vivo, só a ver**: o traço enquanto escreves, as matrizes, o laser e a página em que estás. Podem fazer zoom à vontade; o botão **Seguir o mentor** volta a acompanhar a tua vista.
4. Mantém o teu separador aberto enquanto apresentas. Ao fechar, o link continua a mostrar o último estado do quadro.
5. O link é sempre o mesmo neste browser, por isso podes reutilizá-lo nas aulas seguintes.

## Testar sem Firebase
Com `npm run dev` e sem `.env.local`, o botão Partilhar usa um **modo de teste**: o link funciona noutro separador do mesmo browser. Serve para experimentar antes de configurar o Firebase.
