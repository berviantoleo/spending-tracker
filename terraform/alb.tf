# ── Application Load Balancer ─────────────────────────────────────────────────

resource "aws_lb" "main" {
  name               = "${var.app_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false # set to true for production

  tags = local.common_tags
}

# ── Target Group ──────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "server" {
  name        = "${var.app_name}-tg"
  port        = var.server_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip" # required for Fargate awsvpc networking

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = local.common_tags
}

# ── Listeners ─────────────────────────────────────────────────────────────────

# HTTP listener — forwards all traffic to ECS
# For HTTPS, add an aws_lb_listener on port 443 with your ACM certificate ARN
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.server.arn
  }

  tags = local.common_tags
}
