output "resource_group_name" {
  description = "Grupo de recursos del staging."
  value       = azurerm_resource_group.main.name
}

output "vm_name" {
  description = "Nombre de la maquina virtual."
  value       = azurerm_linux_virtual_machine.main.name
}

output "public_ip_address" {
  description = "IP publica del servidor de staging."
  value       = azurerm_public_ip.main.ip_address
}

output "fqdn" {
  description = "Nombre DNS del servidor; es la direccion publica (HTTPS) de la aplicacion."
  value       = azurerm_public_ip.main.fqdn
}

output "ssh_command" {
  description = "Comando para entrar al servidor (requiere la llave privada)."
  value       = "ssh ${var.admin_username}@${azurerm_public_ip.main.fqdn}"
}