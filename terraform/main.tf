# Spending Tracker — AWS Infrastructure
# Provisions: VPC, ECR, ECS Fargate, ALB, S3 + CloudFront, Secrets Manager, IAM
#
# Usage:
#   cd terraform
#   cp terraform.tfvars.example terraform.tfvars   # fill in values
#   terraform init
#   terraform plan
#   terraform apply

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.62"
    }
  }

  # Uncomment to store state in S3 (recommended for team usage)
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "spending-tracker/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region
}
