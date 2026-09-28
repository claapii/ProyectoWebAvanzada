variable "project_name" {
  description = "Nombre del proyecto"
  type        = string
  default     = "LISTOCO"
}

variable "environment" {
  description = "Ambiente de despliegue"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "El ambiente debe ser staging o production."
  }
}