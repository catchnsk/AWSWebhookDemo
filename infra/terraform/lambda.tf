data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals { type = "Service" identifiers = ["lambda.amazonaws.com"] }
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "family-activity-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_security_group" "lambda_sg" {
  name        = "family-activity-lambda-sg"
  description = "Lambda SG"
  vpc_id      = aws_vpc.main.id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group_rule" "rds_ingress" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.lambda_sg.id
}

variable "api_lambda_s3_bucket" { type = string, default = null }
variable "api_lambda_s3_key" { type = string, default = null }

resource "aws_lambda_function" "api" {
  function_name = "family-activity-api"
  role          = aws_iam_role.lambda_role.arn
  handler       = "lambda_handler.handler"
  runtime       = "python3.12"
  architectures = ["arm64"]
  filename      = var.api_lambda_s3_bucket == null ? "../backendpy/api_lambda.zip" : null
  s3_bucket     = var.api_lambda_s3_bucket
  s3_key        = var.api_lambda_s3_key
  timeout       = 30
  memory_size   = 512

  vpc_config {
    security_group_ids = [aws_security_group.lambda_sg.id]
    subnet_ids         = [for s in aws_subnet.private : s.id]
  }

  environment {
    variables = {
      DATABASE_HOST     = aws_db_instance.postgres.address
      DATABASE_PORT     = aws_db_instance.postgres.port
      DATABASE_NAME     = var.db_name
      DATABASE_USER     = var.db_username
      DATABASE_PASSWORD = var.db_password
      NODE_ENV          = "production"
    }
  }
}

resource "aws_lambda_function" "sqs_worker" {
  function_name = "family-activity-sqs-worker"
  role          = aws_iam_role.lambda_role.arn
  handler       = "lambdas/sqs_worker/handler.handler"
  runtime       = "python3.12"
  architectures = ["arm64"]
  filename      = var.api_lambda_s3_bucket == null ? "../backendpy/api_lambda.zip" : null
  s3_bucket     = var.api_lambda_s3_bucket
  s3_key        = var.api_lambda_s3_key
  timeout       = 60
  memory_size   = 512

  vpc_config {
    security_group_ids = [aws_security_group.lambda_sg.id]
    subnet_ids         = [for s in aws_subnet.private : s.id]
  }

  environment {
    variables = {
      DATABASE_HOST     = aws_db_instance.postgres.address
      DATABASE_PORT     = aws_db_instance.postgres.port
      DATABASE_NAME     = var.db_name
      DATABASE_USER     = var.db_username
      DATABASE_PASSWORD = var.db_password
      NODE_ENV          = "production"
    }
  }
}

resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.webhook_queue.arn
  function_name    = aws_lambda_function.sqs_worker.arn
  batch_size       = 10
  enabled          = true
}


