# Infraestructura de staging (Azure)

Terraform crea la red, el firewall, la IP pública y la máquina virtual del staging.
El estado se guarda en un Storage Account de Azure, **nunca** en el repositorio.

## Preparación única (Azure Cloud Shell, en el portal)

```bash
SUB=$(az account show --query id -o tsv)
LOC=<region permitida por tu suscripcion>
SA=stlistocotf<sufijo-unico-en-minusculas>   # 3-24 caracteres, minusculas y numeros

# 1) Registrar los proveedores de recursos (el proveedor azurerm 5 ya no lo hace solo)
for ns in Microsoft.Compute Microsoft.Network Microsoft.Storage; do az provider register --namespace $ns; done

# 2) Estado remoto de Terraform
az group create -n rg-listoco-tfstate -l $LOC
az storage account create -n $SA -g rg-listoco-tfstate -l $LOC --sku Standard_LRS \
  --min-tls-version TLS1_2 --allow-blob-public-access false
az storage container create --account-name $SA -n tfstate --auth-mode key

# 3) Credenciales para Terraform en GitHub Actions
az ad sp create-for-rbac --name sp-listoco-terraform --role Contributor --scopes /subscriptions/$SUB
```

Del paso 3, `appId` es `ARM_CLIENT_ID`, `password` es `ARM_CLIENT_SECRET` y `tenant` es `ARM_TENANT_ID`.
Guárdalos de inmediato: la contraseña no se vuelve a mostrar.

## Llave SSH de despliegue (en tu computador)

```bash
ssh-keygen -t ed25519 -f listoco-staging -N "" -C listoco-staging
```

`listoco-staging.pub` es pública (variable `SSH_PUBLIC_KEY`). `listoco-staging` es privada: va solo como secreto
`SSH_PRIVATE_KEY`; no la subas al repositorio ni la compartas.

## Configuración en GitHub (Settings > Secrets and variables > Actions)

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | `ARM_CLIENT_ID` | `appId` del paso 3 |
| Secret | `ARM_CLIENT_SECRET` | `password` del paso 3 |
| Secret | `ARM_TENANT_ID` | `tenant` del paso 3 |
| Secret | `ARM_SUBSCRIPTION_ID` | `$SUB` |
| Secret | `SSH_PRIVATE_KEY` | contenido de `listoco-staging` |
| Variable | `AZURE_LOCATION` | la región elegida |
| Variable | `AZURE_DNS_LABEL` | etiqueta única, por ejemplo `listoco-staging-ab12` |
| Variable | `SSH_PUBLIC_KEY` | contenido de `listoco-staging.pub` |
| Variable | `TFSTATE_RESOURCE_GROUP` | `rg-listoco-tfstate` |
| Variable | `TFSTATE_STORAGE_ACCOUNT` | el valor de `$SA` |
| Variable | `TFSTATE_CONTAINER` | `tfstate` |

Mientras no estén configurados, el CI ejecuta `fmt` y `validate` y omite el `plan` con un aviso.

## Notas

- Si `apply` falla con `RequestDisallowedByAzure`, la región o el tamaño de VM no están permitidos
  en la suscripción: cambia `AZURE_LOCATION` o `vm_size`.
- Ahorro de crédito: desasigna la VM cuando no la uses (portal: Detener). Sin cómputo asignado no se cobra.