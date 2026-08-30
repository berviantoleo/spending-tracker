# ── General ──────────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-southeast-1"
}

variable "app_name" {
  description = "Short application name used in resource names and tags"
  type        = string
  default     = "spending-tracker"
}

variable "environment" {
  description = "Deployment environment (e.g. prod, staging)"
  type        = string
  default     = "prod"
}

# ── Networking ───────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for the two public subnets (different AZs)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for the two private subnets (ECS tasks run here)"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

# ── ECS / Container ──────────────────────────────────────────────────────────

variable "server_image_tag" {
  description = "Docker image tag to deploy (e.g. latest or a git SHA). The image must already exist in ECR."
  type        = string
  default     = "latest"
}

variable "server_cpu" {
  description = "vCPU units for the ECS task (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "server_memory" {
  description = "Memory (MiB) for the ECS task"
  type        = number
  default     = 512
}

variable "server_desired_count" {
  description = "Number of ECS task replicas"
  type        = number
  default     = 1
}

variable "server_port" {
  description = "Port the Express server listens on inside the container"
  type        = number
  default     = 3001
}

# ── Application secrets (stored in Secrets Manager) ──────────────────────────

variable "supabase_url" {
  description = "Supabase project URL (https://xxx.supabase.co)"
  type        = string
  sensitive   = true
}

variable "supabase_service_key" {
  description = "Supabase service role key (keep secret)"
  type        = string
  sensitive   = true
}

variable "supabase_anon_key" {
  description = "Supabase anon/public key"
  type        = string
  sensitive   = true
}

variable "watsonx_api_key" {
  description = "IBM Cloud IAM API key for watsonx.ai"
  type        = string
  sensitive   = true
}

variable "watsonx_project_id" {
  description = "watsonx.ai project ID"
  type        = string
  sensitive   = true
}

variable "watsonx_url" {
  description = "watsonx.ai endpoint URL (e.g. https://us-south.ml.cloud.ibm.com)"
  type        = string
  default     = "https://us-south.ml.cloud.ibm.com"
}

variable "watsonx_model_id" {
  description = "watsonx.ai model ID"
  type        = string
  default     = "meta-llama/llama-4-maverick-17b-128e-instruct-fp8"
}

variable "fx_api_base_url" {
  description = "FX rates API base URL"
  type        = string
  default     = "https://api.frankfurter.app"
}
