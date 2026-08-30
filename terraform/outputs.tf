# ── ECR Repository ────────────────────────────────────────────────────────────

output "ecr_repository_url" {
  description = "ECR repository URL — use this as the image prefix when pushing Docker images"
  value       = aws_ecr_repository.server.repository_url
}

# ── ECS ───────────────────────────────────────────────────────────────────────

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name (used by the deploy script to force a new deployment)"
  value       = aws_ecs_service.server.name
}

# ── ALB ───────────────────────────────────────────────────────────────────────

output "alb_dns_name" {
  description = "ALB DNS name — API is reachable at http://<alb_dns_name>/api"
  value       = aws_lb.main.dns_name
}

# ── CloudFront ────────────────────────────────────────────────────────────────

output "cloudfront_domain" {
  description = "CloudFront distribution domain — serve the React app from here"
  value       = aws_cloudfront_distribution.client.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID — used to invalidate cache after deploys"
  value       = aws_cloudfront_distribution.client.id
}

# ── S3 ────────────────────────────────────────────────────────────────────────

output "s3_bucket_name" {
  description = "S3 bucket name for React client build artefacts"
  value       = aws_s3_bucket.client.id
}

# ── Secrets ───────────────────────────────────────────────────────────────────

output "secrets_manager_arn" {
  description = "ARN of the Secrets Manager secret (for CI/CD secrets rotation)"
  value       = aws_secretsmanager_secret.app_secrets.arn
}
