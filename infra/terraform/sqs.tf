resource "aws_sqs_queue" "webhook_dlq" {
  name                       = "webhook-deliveries-dlq"
  message_retention_seconds  = 1209600 # 14 days
  visibility_timeout_seconds = 60
}

resource "aws_sqs_queue" "webhook_queue" {
  name                       = "webhook-deliveries"
  visibility_timeout_seconds = 60
  receive_wait_time_seconds  = 20
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.webhook_dlq.arn
    maxReceiveCount     = 5
  })
}

output "sqs_queue_url" { value = aws_sqs_queue.webhook_queue.id }
output "sqs_dlq_url" { value = aws_sqs_queue.webhook_dlq.id }


