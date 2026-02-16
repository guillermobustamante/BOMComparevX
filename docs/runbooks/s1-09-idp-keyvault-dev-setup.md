# S1-09 Dev Setup: OAuth + Azure Key Vault

This runbook provisions Google and Microsoft OAuth credentials for **Dev** and stores them in Azure Key Vault.

## 1. Prerequisites
- Azure subscription access with rights to Key Vault secrets.
- Google Cloud Console access.
- Microsoft Entra app registration permissions.

## 2. Google OAuth (Dev)
1. Create OAuth Client (Web application) in Google Cloud Console.
2. Configure redirect URI: `http://localhost:4000/auth/google/callback`.
3. Capture client ID and client secret.

## 3. Microsoft Entra OAuth (Dev)
1. Register application in Microsoft Entra.
2. Add Web redirect URI: `http://localhost:4000/auth/microsoft/callback`.
3. Capture application (client) ID and client secret.

## 4. Store Secrets in Azure Key Vault
Set these secret names (matching `.env.example`):
- `google-client-id`
- `google-client-secret`
- `microsoft-client-id`
- `microsoft-client-secret`

Example (PowerShell):
```powershell
az keyvault secret set --vault-name <kv-name> --name google-client-id --value "<google-client-id>"
az keyvault secret set --vault-name <kv-name> --name google-client-secret --value "<google-client-secret>"
az keyvault secret set --vault-name <kv-name> --name microsoft-client-id --value "<microsoft-client-id>"
az keyvault secret set --vault-name <kv-name> --name microsoft-client-secret --value "<microsoft-client-secret>"
```

## 5. App Configuration Contract
Populate local `.env.local` with non-secret entries and secret name mappings:
- `AZURE_KEY_VAULT_URI`
- `GOOGLE_CLIENT_ID_SECRET_NAME`
- `GOOGLE_CLIENT_SECRET_SECRET_NAME`
- `MICROSOFT_CLIENT_ID_SECRET_NAME`
- `MICROSOFT_CLIENT_SECRET_SECRET_NAME`

## 6. Rotation Policy (Minimum)
- Rotate provider secrets every 90 days or on incident.
- Update Key Vault secret values first, then restart app instances.
- Verify login smoke tests after rotation.

## 7. Smoke Validation (Dev)
- Google login success path.
- Microsoft login success path.
- Invalid callback/state rejection path.
- Confirm no client secrets are printed in logs.

## 8. Ownership
- Platform owner: maintains Key Vault access policy.
- Application owner: maintains callback URLs and env contract.
