# Publicar usando somente o tablet

1. No GitHub, crie um repositório público chamado `impacto-obu-system`.
2. Abra o repositório e toque em **Add file > Upload files**.
3. Extraia o ZIP no tablet e envie todos os arquivos para a raiz do repositório.
4. Abra **Settings > Pages**.
5. Em **Source**, escolha **Deploy from a branch**.
6. Escolha a branch **main** e a pasta **/ (root)**. Salve.
7. Aguarde alguns minutos. O endereço ficará parecido com:
   `https://SEU-USUARIO.github.io/impacto-obu-system/`

## Autorizar o domínio no Firebase

Firebase Console > Authentication > Configurações > Domínios autorizados.
Adicione: `SEU-USUARIO.github.io`

## Publicar regras do Firestore

Firebase Console > Firestore Database > Regras.
Copie o conteúdo de `firestore.rules`, substitua as regras atuais e clique em **Publicar**.

## Primeiro acesso

Abra o site e toque em **Criar primeiro administrador**. Use seu e-mail e uma senha segura.
