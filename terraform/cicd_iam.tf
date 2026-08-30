# ── IAM user for GitHub Actions CI/CD ────────────────────────────────────────
# This user is granted the minimum permissions needed for the two deploy workflows.
# After running `terraform apply`, create an access key for this user in the AWS
# console and store the key/secret as GitHub Actions secrets.

resource "aws_iam_user" "cicd" {
  name = "${var.app_name}-cicd"
  tags = local.common_tags
}

resource "aws_iam_user_policy" "cicd" {
  name = "${var.app_name}-cicd-policy"
  user = aws_iam_user.cicd.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [

      # ── ECR: authenticate, push images ──────────────────────────────────
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeRepositories",
          "ecr:GetDownloadUrlForLayer",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
        ]
        Resource = aws_ecr_repository.server.arn
      },

      # ── ECS: force new deployment + wait ────────────────────────────────
      {
        Sid    = "ECSUpdateService"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
        ]
        Resource = "arn:aws:ecs:${var.aws_region}:*:service/${aws_ecs_cluster.main.name}/${aws_ecs_service.server.name}"
      },

      # ── S3: sync build artefacts ─────────────────────────────────────────
      {
        Sid    = "S3Deploy"
        Effect = "Allow"
        Action = [
          "s3:DeleteObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:PutObject",
          "s3:PutObjectAcl",
        ]
        Resource = [
          aws_s3_bucket.client.arn,
          "${aws_s3_bucket.client.arn}/*",
        ]
      },

      # ── CloudFront: create and wait for invalidations ────────────────────
      {
        Sid    = "CloudFrontInvalidate"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetInvalidation",
        ]
        Resource = "arn:aws:cloudfront::*:distribution/${aws_cloudfront_distribution.client.id}"
      },
    ]
  })
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "cicd_iam_user_name" {
  description = "IAM user name for GitHub Actions — create an access key for this user"
  value       = aws_iam_user.cicd.name
}
