# Assinatura de código para o auto-update do Agent

O auto-update (`PrinterAgent.Core/Update/AuthenticodeVerifier.cs` +
`AgentUpdateChecker.cs` + `PrinterAgent.Updater`) só instala uma release
nova se o `.msi`:

1. Tiver o hash SHA-256 batendo com o que a Plataforma publicou (integridade
   — pega download truncado/corrompido, não um ataque).
2. Estiver assinado com Authenticode válido, com cadeia de confiança real
   validada pelo próprio Windows (`WinVerifyTrust`), **e** o thumbprint do
   certificado de assinatura bater com uma constante compilada dentro do
   próprio Agent (`AuthenticodeVerifier.ExpectedThumbprint`) — é essa
   segunda checagem que impede um servidor de download comprometido de
   empurrar um binário assinado por *qualquer outro* certificado válido.

## Situação atual: placeholder

`ExpectedThumbprint` hoje é `"0000000000000000000000000000000000000000"` —
um placeholder que **nenhum certificado real vai bater**, então o
auto-update está efetivamente desligado (todo download é rejeitado) até
você trocar isso por um certificado de verdade. Isso foi validado de ponta
a ponta nesta sessão com um certificado de teste autoassinado (gerado,
usado, removido — não fica em lugar nenhum do repositório).

## O que só você pode fazer

Comprar um certificado de assinatura de código de uma autoridade
certificadora (DigiCert, Sectigo, etc.) exige verificação de identidade da
empresa — isso não dá pra automatizar nem terceirizar pra uma IA.

## Passo a passo pra ativar de verdade

1. Compre/obtenha o certificado de assinatura de código (arquivo `.pfx` ou
   um certificado em hardware token/HSM, dependendo do que a CA oferecer).
2. Importe o certificado no repositório de certificados do Windows da
   máquina/pipeline que vai assinar as releases:
   ```powershell
   Import-PfxCertificate -FilePath seu-certificado.pfx -CertStoreLocation Cert:\CurrentUser\My
   ```
3. Pegue o thumbprint:
   ```powershell
   Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -like "*Sua Empresa*" }
   ```
4. Cole esse thumbprint em
   `apps/agent-windows/src/PrinterAgent.Core/Update/AuthenticodeVerifier.cs`,
   substituindo o placeholder em `ExpectedThumbprint`, e recompile/republique
   o Agent (esse valor fica embutido no binário — trocar o certificado sem
   recompilar o Agent já instalado nos clientes não funciona).
5. Assine cada `.msi` antes de publicar como release:
   ```powershell
   signtool sign /sha1 <thumbprint> /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 PrinterAgentSetup.msi
   ```
   (`signtool.exe` vem com o Windows SDK — se não tiver instalado,
   `winget install Microsoft.WindowsSDK.10` ou baixe só as ferramentas de
   build do SDK.)
6. Calcule o SHA-256 do `.msi` já assinado (tem que ser o arquivo final,
   assinar muda os bytes):
   ```powershell
   (Get-FileHash PrinterAgentSetup.msi -Algorithm SHA256).Hash
   ```
7. Publique a release em Plataforma → Releases do Agent, com esse hash e a
   URL de onde o `.msi` assinado está hospedado (GitHub Release, S3, etc. —
   a Plataforma só guarda os metadados, não hospeda o binário).

## Testando sem gastar com um certificado de verdade ainda

Pra testar o mecanismo de verificação sem ter um certificado real, gere um
de teste, confie nele temporariamente, teste, e desfaça tudo depois (é
exatamente o que foi feito nesta sessão pra validar `AuthenticodeVerifier`):

```powershell
# 1. Gerar certificado de teste
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Teste" `
    -CertStoreLocation Cert:\CurrentUser\My -KeyUsage DigitalSignature `
    -KeyAlgorithm RSA -KeyLength 2048 -NotAfter (Get-Date).AddYears(1)

# 2. Assinar um .msi de teste
Set-AuthenticodeSignature -FilePath PrinterAgentSetup.msi -Certificate $cert -HashAlgorithm SHA256

# 3. Confiar nele temporariamente (só pra teste local!)
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
$store.Open("ReadWrite"); $store.Add($cert); $store.Close()

# ... trocar ExpectedThumbprint pro thumbprint do $cert, recompilar, testar ...

# 4. Desfazer — SEMPRE remova o certificado de teste depois
certutil -delstore -user Root <thumbprint>
certutil -delstore -user My <thumbprint>
```

Nunca deixe um certificado de teste confiado permanentemente numa máquina —
é exatamente o tipo de coisa que enfraquece a segurança que esse mecanismo
inteiro existe pra garantir.
