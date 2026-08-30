# ── ECR Repository ────────────────────────────────────────────────────────────

resource "aws_ecr_repository" "server" {
  name                 = "${var.app_name}-server"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

resource "aws_ecr_lifecycle_policy" "server" {
  repository = aws_ecr_repository.server.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only the 10 most recent images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = { type = "expire" }
      }
    ]
  })
}

# ── ECS Cluster ───────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "${var.app_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# ── CloudWatch Log Group ──────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "server" {
  name              = "/ecs/${var.app_name}-server"
  retention_in_days = 14
  tags              = local.common_tags
}

# ── IAM — ECS Task Execution Role ────────────────────────────────────────────
# Allows ECS to pull images from ECR and write logs to CloudWatch

resource "aws_iam_role" "ecs_execution" {
  name = "${var.app_name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow execution role to read secrets from Secrets Manager
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.app_name}-ecs-secrets-policy"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.app_secrets.arn]
    }]
  })
}

# ── IAM — ECS Task Role ───────────────────────────────────────────────────────
# Permissions granted to the running container itself

resource "aws_iam_role" "ecs_task" {
  name = "${var.app_name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

# ── ECS Task Definition ───────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "server" {
  family                   = "${var.app_name}-server"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.server_cpu
  memory                   = var.server_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "server"
      image     = "${aws_ecr_repository.server.repository_url}:${var.server_image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = var.server_port
          protocol      = "tcp"
        }
      ]

      # Secrets injected from AWS Secrets Manager at task startup
      secrets = [
        { name = "SUPABASE_URL",          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:SUPABASE_URL::" },
        { name = "SUPABASE_SERVICE_KEY",  valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:SUPABASE_SERVICE_KEY::" },
        { name = "SUPABASE_ANON_KEY",     valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:SUPABASE_ANON_KEY::" },
        { name = "WATSONX_API_KEY",       valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:WATSONX_API_KEY::" },
        { name = "WATSONX_PROJECT_ID",    valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:WATSONX_PROJECT_ID::" },
      ]

      # Non-sensitive env vars injected directly
      environment = [
        { name = "NODE_ENV",           value = "production" },
        { name = "PORT",               value = tostring(var.server_port) },
        { name = "WATSONX_URL",        value = var.watsonx_url },
        { name = "WATSONX_MODEL_ID",   value = var.watsonx_model_id },
        { name = "FX_API_BASE_URL",    value = var.fx_api_base_url },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.server.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:${var.server_port}/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])

  tags = local.common_tags
}

# ── ECS Service ───────────────────────────────────────────────────────────────

resource "aws_ecs_service" "server" {
  name            = "${var.app_name}-server"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.server.arn
  desired_count   = var.server_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.server.arn
    container_name   = "server"
    container_port   = var.server_port
  }

  # Allow Terraform to change task definition without recreating the service
  lifecycle {
    ignore_changes = [task_definition]
  }

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy_attachment.ecs_execution_managed,
  ]

  tags = local.common_tags
}
