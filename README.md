# Site CTP - Registro de Atendimentos

Este projeto é um site simples em HTML, CSS e JavaScript para registrar atendimentos da CTP.

## Arquivos

- `index.html`: página inicial.
- `formulario.html`: formulário de registro.
- `dashboard.html`: dashboard local para testes.
- `relatorios.html`: orientações de relatórios.
- `styles.css`: aparência do site.
- `app.js`: funcionamento do formulário e dashboard.
- `config.js`: local para configurar a URL do Power Automate.

## Como testar no computador

1. Abra a pasta no Visual Studio Code.
2. Instale a extensão **Live Server**.
3. Clique com o botão direito em `index.html`.
4. Escolha **Open with Live Server**.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie estes arquivos para o repositório usando o GitHub Desktop.
3. No GitHub, acesse:
   - Settings
   - Pages
   - Source: Deploy from a branch
   - Branch: main
   - Folder: /root
4. Salve.
5. Aguarde alguns minutos e acesse o link gerado pelo GitHub Pages.

## Integração com Excel Online

O site está preparado para enviar os dados para um fluxo do Power Automate.

No arquivo `config.js`, troque:

```js
const POWER_AUTOMATE_URL = "";
```

pela URL do gatilho HTTP do seu fluxo.

Enquanto a URL estiver vazia, o site salva os registros apenas no navegador, para teste local.
