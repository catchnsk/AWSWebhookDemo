variable "db_name" { type = string, default = "webhook_db" }
variable "db_username" { type = string, default = "webhook_user" }
variable "db_password" { type = string, sensitive = true }

resource "aws_db_subnet_group" "rds" {
  name       = "family-activity-rds-subnet-group"
  subnet_ids = [for s in aws_subnet.private : s.id]
}

resource "aws_security_group" "rds" {
  name        = "family-activity-rds-sg"
  description = "RDS PostgreSQL access from Lambda"
  vpc_id      = aws_vpc.main.id
}

resource "aws_db_instance" "postgres" {
  identifier                 = "family-activity-postgres"
  engine                     = "postgres"
  engine_version             = "15.5"
  instance_class             = "db.t4g.micro"
  allocated_storage          = 20
  storage_type               = "gp3"
  db_subnet_group_name       = aws_db_subnet_group.rds.name
  vpc_security_group_ids     = [aws_security_group.rds.id]
  username                   = var.db_username
  password                   = var.db_password
  db_name                    = var.db_name
  skip_final_snapshot        = true
  backup_retention_period    = 7
  publicly_accessible        = false
  multi_az                   = false
  auto_minor_version_upgrade = true
}

output "db_endpoint" { value = aws_db_instance.postgres.address }
output "db_port" { value = aws_db_instance.postgres.port }


