variable "project" {
  description = "Nombre corto del proyecto; se usa para nombrar los recursos."
  type        = string
  default     = "listoco"
}

variable "environment" {
  description = "Ambiente que se despliega."
  type        = string
  default     = "staging"
}

variable "location" {
  description = "Region de Azure. Debe ser una de las permitidas por la suscripcion (en Azure for Students algunas regiones estan restringidas)."
  type        = string
}

variable "dns_label" {
  description = "Etiqueta DNS de la IP publica; el servidor quedara en <etiqueta>.<region>.cloudapp.azure.com. Debe ser unica dentro de la region."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,61}[a-z0-9]$", var.dns_label))
    error_message = "La etiqueta DNS debe tener entre 3 y 63 caracteres: minusculas, numeros y guiones, empezando con una letra y sin terminar en guion."
  }
}

variable "vm_size" {
  description = "Tamano de la maquina virtual. Verificar precio y disponibilidad en la region elegida."
  type        = string
  default     = "Standard_B1s"
}

variable "admin_username" {
  description = "Usuario sin privilegios de administrador con el que se hace el despliegue por SSH."
  type        = string
  default     = "deploy"
}

variable "ssh_public_key" {
  description = "Llave PUBLICA SSH autorizada para el usuario de despliegue. La llave privada nunca va en el repositorio: se guarda como secreto de GitHub."
  type        = string

  validation {
    condition     = can(regex("^ssh-(ed25519|rsa) ", var.ssh_public_key))
    error_message = "Debe ser una llave publica SSH en formato OpenSSH (ssh-ed25519 o ssh-rsa)."
  }
}

variable "ssh_source_address_prefix" {
  description = "Origen permitido para el puerto 22. Por defecto cualquiera, porque los runners de GitHub no tienen IP fija; la proteccion es la autenticacion solo por llave."
  type        = string
  default     = "*"
}

variable "tags" {
  description = "Etiquetas adicionales para los recursos."
  type        = map(string)
  default     = {}
}