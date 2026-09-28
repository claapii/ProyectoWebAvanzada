output "project_name" {
  description = "Nombre del proyecto"
  value       = var.project_name
}

output "environment" {
  description = "Ambiente configurado"
  value       = var.environment
}

output "staging_description_file" {
  description = "Archivo generado con la descripcion del ambiente staging"
  value       = local_file.staging_info.filename
}