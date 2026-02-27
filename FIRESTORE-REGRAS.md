# 🔐 Configuração de Regras do Firestore

## ⚠️ URGENTE: Implante estas regras no Firebase Console

O erro **"Missing or insufficient permissions"** acontece quando as regras do Firestore no servidor não correspondem ao arquivo local `firestore.rules`.

## 📋 Passo a Passo

### 1. Acesse o Firebase Console

1. Vá para: https://console.firebase.google.com/
2. Selecione o projeto: **colacaodegrauatila**
3. No menu lateral, clique em **Firestore Database**
4. Clique na aba **Regras** (Rules)

### 2. Cole as Regras Corretas

Substitua **TODO** o conteúdo da aba de regras por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Collection: messages
    match /messages/{messageId} {

      // Permite leitura para todos (incluindo usuários anônimos)
      allow read: if true;

      // Permite criação para usuários autenticados (incluindo anônimos)
      allow create: if request.auth != null
                    && request.resource.data.keys().hasAll(['name', 'message', 'createdAt'])
                    && request.resource.data.name is string
                    && request.resource.data.name.size() >= 1
                    && request.resource.data.name.size() <= 40
                    && request.resource.data.message is string
                    && request.resource.data.message.size() >= 1
                    && request.resource.data.message.size() <= 280;

      // NÃO permite atualização ou deleção
      allow update, delete: if false;
    }
  }
}
```

### 4. Habilite Autenticação Anônima

1. No menu lateral, clique em **Authentication**
2. Clique na aba **Sign-in method**
3. Na lista de provedores, clique em **Anônimo** (Anonymous)
4. **Ative** o toggle "Ativar"
5. Clique em **Salvar**

## ✅ Verificação

Após publicar as regras e habilitar autenticação anônima:

1. Recarregue a página do seu site
2. Abra o console do navegador (F12)
3. Verifique se aparece: `[Auth] ✓ Autenticado: <algum-uid>`
4. Tente enviar uma mensagem
5. Deve aparecer: `[Firestore] ✅ Mensagem adicionada: <doc-id>`

## 🔍 O que as Regras Fazem

- ✅ **Leitura**: Qualquer pessoa pode ler mensagens
- ✅ **Criação**: Apenas usuários autenticados (incluindo anônimos) podem criar
- ✅ **Validação**:
  - Nome (1-40 chars) obrigatório
  - Mensagem (1-280 chars) obrigatória
  - CreatedAt (timestamp) obrigatório
- ❌ **Edição/Exclusão**: Ninguém pode modificar ou deletar mensagens

## 🐛 Debug

Se o erro persistir após publicar as regras, verifique no console:

```javascript
// Deve aparecer:
[firebase.js] Carregando...
[firebase.js] ✅ FirebaseService exportado para window
[app.js] Carregando...
[app.js] FirebaseService disponível? object [object Object]
[Firebase] Inicializando...
[Firebase] App inicializado ✓
[Firebase] Auth obtido ✓
[Firebase] Firestore obtido ✓
[Auth] ✓ Autenticado: <uid>
[Firebase] ✅ Inicializado com sucesso
```

Se `FirebaseService disponível?` retornar `undefined`, recarregue a página com cache limpo (Cmd+Shift+R no Mac, Ctrl+Shift+R no Windows).
