# ── AWS Secrets Manager — application secrets ─────────────────────────────────
# All sensitive env vars are stored as a single JSON secret.
# The ECS task definition reads individual keys using the JSON key syntax.

resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "${var.app_name}/${var.environment}/app-secrets"
  description = "Spending Tracker application secrets (Supabase + watsonx.ai)"

  # Allow immediate deletion in dev; increase for production
  recovery_window_in_days = 0

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id

  secret_string = jsonencode({
    SUPABASE_URL         = var.supabase_url
    SUPABASE_SERVICE_KEY = var.supabase_service_key
    SUPABASE_ANON_KEY    = var.supabase_anon_key
    WATSONX_API_KEY      = var.watsonx_api_key
    WATSONX_PROJECT_ID   = var.watsonx_project_id
  })

  # Prevent Terraform plan/apply from showing secret values in the diff
  lifecycle {
    ignore_changes = [secret_string]
  }
}
