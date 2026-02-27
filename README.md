# Mural da Colação do Átila

Site estático 100% em HTML/CSS/JS para coleta de mensagens de carinho para formatura. Design minimalista com estética "papel/bege", avião ASCII animado carregando mensagens e integração Firebase.

## Características

- **Estética Premium**: Design minimalista bege/off-white com efeito glass morphism
- **Avião ASCII**: Atravessa a tela carregando um banner com mensagens do banco
- **Mensagens Poéticas**: Sobem suavemente no fundo (estilo parallax)
- **Responsivo**: Funciona em mobile (320px+), tablet e desktop
- **Acessibilidade**: Suporta `prefers-reduced-motion` para usuários sensíveis a animações
- **iOS Safe Areas**: Compatível com notch e home indicator
- **Sem Login Visível**: Autenticação anônima automática do Firebase
- **Zero Build**: Puro HTML/CSS/JS, sem frameworks ou bundlers

## Estrutura do Projeto

```
MuralAviaozinho/
├── index.html          # HTML principal
├── styles.css          # Estilos (responsivo, acessível)
├── app.js              # Orquestrador principal + CONFIG
├── firebase.js         # Integração Firebase
├── plane.js            # Gerenciador do avião ASCII
├── firestore.rules     # Regras de segurança do Firestore
└── README.md           # Este arquivo
```

## Como Rodar Localmente

### Opção 1: Python (já vem no macOS)

```bash
cd MuralAviaozinho
python3 -m http.server 5173
```

Acesse: `http://localhost:5173`

### Opção 2: Node.js (npx)

```bash
cd MuralAviaozinho
npx serve .
```

### Opção 3: VS Code Live Server

1. Instale a extensão "Live Server"
2. Clique direito em `index.html` → "Open with Live Server"

## Configuração do Firebase

### 1. Criar Projeto no Firebase Console

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Crie um novo projeto
3. Habilite **Authentication** → **Sign-in method** → **Anonymous**
4. Crie **Firestore Database** em modo de teste

### 2. Configurar Credenciais

Edite `firebase.js` e substitua as credenciais:

```javascript
firebaseConfig: {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
}
```

### 3. Configurar Regras do Firestore

No Firebase Console, vá em **Firestore Database** → **Rules** e cole o conteúdo de `firestore.rules`.

## Deploy no Azure Static Web Apps

### Pré-requisitos

- Conta no Azure
- Repositório Git (GitHub, Azure DevOps, etc.)

### Passo a Passo

1. **No Azure Portal**, crie um recurso "Static Web App"

2. **Configure o source**:
   - Source: GitHub (ou outro)
   - Selecione seu repositório e branch

3. **Build Details**:
   - Build Preset: `Custom`
   - App location: `/` (ou o caminho até a pasta do projeto)
   - Api location: (deixe vazio)
   - Output location: `/` (não tem build, é estático)

4. **Review + Create**

5. O Azure criará um workflow GitHub Actions automaticamente

### Configuração Manual (sem GitHub Actions)

Se preferir deploy manual:

```bash
# Instale o Azure CLI
brew install azure-cli

# Login
az login

# Deploy direto (substitua pelos seus valores)
az staticwebapp create \
  --name mural-colacao-atila \
  --resource-group MEU_RESOURCE_GROUP \
  --source . \
  --location "eastus2" \
  --branch main \
  --app-location "/" \
  --output-location "/"
```

### Configuração do staticwebapp.config.json (opcional)

Crie `staticwebapp.config.json` na raiz para configurações avançadas:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html"
  },
  "mimeTypes": {
    ".js": "text/javascript",
    ".css": "text/css"
  }
}
```

## Configurações (CONFIG)

Todas as configurações estão centralizadas em `app.js`:

```javascript
const CONFIG = {
  poetry: {
    maxSimultaneous: { mobile: 6, tablet: 9, desktop: 12 },
    spawnInterval: { min: 2000, max: 4000 },
    riseDuration: { min: 20, max: 32 },
    horizontalMargin: 8,
    cardRespectZone: { xStart: 15, xEnd: 85, yStart: 25, yEnd: 75 },
  },
  form: {
    cooldownMs: 8000,
    nameMaxLength: 40,
    messageMaxLength: 280,
  },
  firebase: {
    messagesLimit: 50,
  },
};
```

### Configurações do Avião (plane.js)

```javascript
config: {
  interval: { min: 12000, max: 18000 },
  flightDuration: { desktop: 14000, mobile: 18000 },
  bannerWidth: { desktop: 56, mobile: 36 },
  topPosition: 6,
  maxTextLength: { desktop: 100, mobile: 60 }
}
```

## Breakpoints

- **Mobile pequeno**: até 360px
- **Mobile retrato**: até 480px
- **Mobile paisagem / Tablet**: 481px - 900px
- **Desktop**: acima de 900px

## Acessibilidade

- Suporte a `prefers-reduced-motion`: animações são desativadas
- Focus rings visíveis para navegação por teclado
- Áreas de toque mínimas de 44x44px
- iOS Safe Areas respeitadas

## Licença

Projeto pessoal para formatura. Uso livre para fins educacionais.
