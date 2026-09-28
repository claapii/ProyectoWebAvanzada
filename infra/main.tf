resource "local_file" "staging_info" {
  filename = "${path.module}/staging-description.txt"

  content = <<-EOT
  Proyecto: ${var.project_name}
  Ambiente: ${var.environment}

  Ambiente preliminar de staging para LISTOCO.
  Incluye frontend Angular/Ionic, backend NestJS,
  servicio FastAPI y base de datos PostgreSQL.
  EOT
}