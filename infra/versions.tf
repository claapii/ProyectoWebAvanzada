terraform {
  required_version = ">= 1.9.0, < 2.0.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 5.10.0"
    }
  }

  # El estado de Terraform se guarda fuera del repositorio, en un Storage Account
  # de Azure. Los datos de la cuenta se entregan al iniciar con -backend-config
  # (ver infra/README.md); aqui no hay ningun valor ni credencial.
  backend "azurerm" {}
}

# La autenticacion se entrega por variables de entorno (ARM_CLIENT_ID,
# ARM_CLIENT_SECRET, ARM_TENANT_ID y ARM_SUBSCRIPTION_ID): no se escribe aqui.
provider "azurerm" {
  features {}
}