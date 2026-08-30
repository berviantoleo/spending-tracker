# Spending Tracker

AI-powered web app that scans receipts, auto-categorises spending with watsonx.ai, and tracks multi-currency expenses.

**Stack:** React 19 + Vite 7 (PWA) · Express 5 + TypeScript · Supabase (Postgres / Auth / Storage) · watsonx.ai `llama-4-maverick-17b-128e-instruct-fp8` · AWS ECS Fargate + S3 + CloudFront

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | **26 LTS** | [nodejs.org](https://nodejs.org) |
| npm | ≥ 11 | bundled with Node 26 |
| Supabase CLI | latest | `brew install supabase/tap/supabase` · [all platforms](https://supabase.com/docs/guides/cli/getting-started) |
| Docker | latest | required to build the server image or run `supabase start` locally |
| Terraform | ≥ 1.6 | [terraform.io/downloads](https://developer.hashicorp.com/terraform/downloads) — AWS deployment only |
| AWS CLI | v2 | [aws.amazon.com/cli](https://aws.amazon.com/cli/) — AWS deployment only |

---

## Local Development

### 1 — Install dependencies

```bash
npm install          # installs root + client/ + server/ workspaces in one command
```

### 2 — Configure environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Fill in `server/.env`:

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Dashboard → API Keys → `service_role` (**keep secret — never expose to client**) |
| `SUPABASE_ANON_KEY` | Dashboard → API Keys → `anon` / `public` |
| `WATSONX_API_KEY` | IBM Cloud → IAM → API Keys |
| `WATSONX_PROJECT_ID` | watsonx.ai console → Project → Manage → General |
| `WATSONX_URL` | e.g. `https://us-south.ml.cloud.ibm.com` |
| `WATSONX_MODEL_ID` | `meta-llama/llama-4-maverick-17b-128e-instruct-fp8` |
| `FX_API_BASE_URL` | `https://api.frankfurter.app` (no key required) |
| `PORT` | `3001` (default) |

Fill in `client/.env`:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` above |
| `VITE_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY` above |
| `VITE_API_BASE_URL` | `http://localhost:3001` |

### 3 — Apply database migrations

See [Database — Migrations](#database--migrations) below.

### 4 — Start development servers

```bash
npm run dev
# client → http://localhost:5173
# server → http://localhost:3001
```

Health check:

```bash
curl http://localhost:3001/health
# → { "status": "ok", "timestamp": "..." }
```

---

## Database — Migrations

All schema lives in `supabase/migrations/`. The Supabase CLI (`supabase db push`) is the recommended way to apply and track migrations.

### Option A — Supabase CLI ✅ recommended

```bash
# One-time: log in and link this repo to your cloud project
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
# Your project ref: Dashboard → Project Settings → General → Reference ID

# Push all migrations in timestamp order (idempotent — safe to re-run)
supabase db push

# Seed system categories (run once after the first push)
# Paste the contents of supabase/seed.sql into the Dashboard SQL Editor,
# or use psql with your connection string:
psql "$DATABASE_URL" -f supabase/seed.sql
```

`supabase db push` tracks applied migrations in `supabase_migrations.schema_migrations` and skips any already applied. Use `--dry-run` to preview before committing:

```bash
supabase db push --dry-run
```

### Option B — Supabase Dashboard SQL Editor

Open the SQL Editor in your project dashboard and run each file **in this exact order**:

| # | File | What it creates |
|---|---|---|
| 1 | `supabase/migrations/20240001000000_schema.sql` | All tables, enums, indexes, `updated_at` trigger, Realtime |
| 2 | `supabase/migrations/20240001000001_rls.sql` | Row Level Security policies (all tables) |
| 3 | `supabase/migrations/20240001000002_storage.sql` | Private `receipts` storage bucket + per-user path policies |
| 4 | `supabase/migrations/20240001000003_preferences.sql` | `user_preferences` table |
| — | `supabase/seed.sql` | 8 system spending categories |

### Enable Realtime

After migrations, enable Realtime for the `receipts` table so the client receives live status updates (`processing → done / needs_review`) without polling:

> Supabase Dashboard → **Database** → **Replication** → find `receipts` → toggle to **enabled**

---

## AWS Deployment

Supabase stays in the cloud unchanged. Only the Express server and React client move to AWS.

### Architecture

```
Internet
  │
  ▼
CloudFront  ──  /api/*  ──►  ALB  ──►  ECS Fargate (Express server)
            └──  /*      ──►  S3  (React + Vite build)
```

### 1 — Provision infrastructure with Terraform

```bash
cd terraform

# Copy and fill in your credentials
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — add Supabase keys + watsonx.ai credentials

terraform init
terraform plan    # review what will be created
terraform apply   # provisions all AWS resources (~5 minutes)
```

Resources created:

| Resource | Purpose |
|---|---|
| VPC + subnets + NAT gateway | Isolated private network; ECS tasks run in private subnets |
| ECR repository | Docker image registry for the Express server |
| ECS Fargate cluster + service | Runs the containerised server (no EC2 to manage) |
| Application Load Balancer | Public HTTPS entry point for `/api/*` |
| S3 bucket | Hosts the Vite production build artefacts |
| CloudFront distribution | Global CDN for the React app; proxies `/api/*` to the ALB |
| Secrets Manager | Stores all sensitive env vars; ECS reads them at task startup |
| IAM roles | Least-privilege execution role (ECR + CloudWatch) and task role |
| IAM user `spending-tracker-cicd` | Used by GitHub Actions — scoped to ECR push, ECS update, S3 sync, CloudFront invalidation |
| CloudWatch log group | Server logs, 14-day retention |

### 2 — Deploy the server manually

> GitHub Actions automates this — use these commands only for one-off deploys.

```bash
# Must be run from the repo root (the Dockerfile's build context)
ECR_URL=$(terraform -chdir=terraform output -raw ecr_repository_url)
AWS_REGION=ap-southeast-1

# Authenticate Docker with ECR
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $ECR_URL

# Build for linux/amd64 (required when building on Apple Silicon)
docker build --platform linux/amd64 -t $ECR_URL:latest .
docker push $ECR_URL:latest

# Force ECS to pull and run the new image
aws ecs update-service \
  --cluster "$(terraform -chdir=terraform output -raw ecs_cluster_name)" \
  --service "$(terraform -chdir=terraform output -raw ecs_service_name)" \
  --force-new-deployment \
  --region $AWS_REGION
```

### 3 — Deploy the client manually

> GitHub Actions automates this — use these commands only for one-off deploys.

Before building, create `client/.env.production`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
# CloudFront domain from Terraform output:
VITE_API_BASE_URL=https://$(terraform -chdir=terraform output -raw cloudfront_domain)
```

Then build and deploy:

```bash
npm run build --workspace=client

BUCKET=$(terraform -chdir=terraform output -raw s3_bucket_name)
DIST_ID=$(terraform -chdir=terraform output -raw cloudfront_distribution_id)

# index.html: no-cache (re-validate on every load)
aws s3 cp client/dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"

# JS/CSS: immutable (Vite appends content hashes — safe to cache forever)
aws s3 sync client/dist/ s3://$BUCKET/ \
  --exclude "*.html" \
  --cache-control "public, max-age=31536000, immutable" \
  --delete

# Invalidate CloudFront so edge nodes serve the new index.html immediately
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"
```

### Teardown

```bash
cd terraform
terraform destroy
```

---

## GitHub Actions CI/CD

### Workflows

| Workflow | Trigger | Steps |
|---|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | Every push + every PR | TypeScript typecheck (server + client) · ESLint · Docker build smoke test |
| [`deploy-server.yml`](.github/workflows/deploy-server.yml) | Push to `main` when `server/**` changes | Typecheck → Docker build → ECR push → ECS force-deploy → wait for stable |
| [`deploy-client.yml`](.github/workflows/deploy-client.yml) | Push to `main` when `client/**` changes | Typecheck → Vite build → S3 sync (per-file cache headers) → CloudFront invalidation |

Path filters ensure a client-only change never triggers a Docker build, and a server-only change never touches S3.

### One-time setup

#### 1 — Get the CI/CD IAM credentials

`terraform apply` creates an IAM user (`spending-tracker-cicd`) with least-privilege permissions already attached.

```bash
terraform -chdir=terraform output cicd_iam_user_name
# → spending-tracker-cicd
```

Go to **AWS Console → IAM → Users → `spending-tracker-cicd` → Security credentials → Create access key** and save the key ID and secret.

#### 2 — Add GitHub secrets and variables

Go to your repo → **Settings → Secrets and variables → Actions**.

**Secrets** (never appear in logs):

| Name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM access key ID from step 1 |
| `AWS_SECRET_ACCESS_KEY` | IAM secret access key from step 1 |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

**Variables** (visible in logs — non-sensitive):

| Name | How to get it |
|---|---|
| `AWS_REGION` | `ap-southeast-1` |
| `ECR_REPOSITORY_URL` | `terraform -chdir=terraform output -raw ecr_repository_url` |
| `ECS_CLUSTER_NAME` | `terraform -chdir=terraform output -raw ecs_cluster_name` |
| `ECS_SERVICE_NAME` | `terraform -chdir=terraform output -raw ecs_service_name` |
| `S3_BUCKET_NAME` | `terraform -chdir=terraform output -raw s3_bucket_name` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `terraform -chdir=terraform output -raw cloudfront_distribution_id` |
| `VITE_API_BASE_URL` | `https://` + `terraform -chdir=terraform output -raw cloudfront_domain` |

#### 3 — Push to `main`

Workflows trigger automatically on the next push.

---

## Project Structure

```
spending-tracker/
├── client/                          React 19 + Vite 7 + TypeScript (PWA)
│   ├── public/icons/                PWA icons (192 × 512 px)
│   └── src/
│       ├── components/              Layout, ReceiptCard, ReceiptUploader, …
│       ├── context/AuthContext.tsx  Supabase Auth session state
│       ├── hooks/                   useAuth, useOnboarding, usePreferences, …
│       ├── lib/                     supabaseClient, apiClient, currencies
│       ├── pages/                   Dashboard, Receipts, Setup, Settings, Detail
│       └── types/receipt.ts         Shared TypeScript types
├── server/                          Express 5 + TypeScript
│   └── src/
│       ├── middleware/requireAuth.ts  JWT verification
│       ├── prompts/                   watsonx.ai prompt templates
│       ├── routes/                    receipts, analytics, preferences, categories
│       └── services/                  watsonxService, receiptProcessor, fxService, storageService
├── supabase/
│   ├── config.toml                  Supabase CLI config (`supabase link` + `supabase db push`)
│   ├── .env.example                 Google OAuth secrets for local dev
│   ├── migrations/
│   │   ├── 20240001000000_schema.sql
│   │   ├── 20240001000001_rls.sql
│   │   ├── 20240001000002_storage.sql
│   │   └── 20240001000003_preferences.sql
│   └── seed.sql                     8 system spending categories
├── terraform/
│   ├── main.tf                      Provider + optional S3 backend
│   ├── variables.tf                 All input variables with descriptions
│   ├── terraform.tfvars.example     Copy → terraform.tfvars and fill in secrets
│   ├── locals.tf                    Common resource tags
│   ├── networking.tf                VPC, subnets, NAT, security groups
│   ├── ecs.tf                       ECR, ECS cluster/task/service, IAM roles
│   ├── alb.tf                       Application Load Balancer + target group
│   ├── frontend.tf                  S3 bucket + CloudFront distribution
│   ├── secrets.tf                   AWS Secrets Manager
│   ├── cicd_iam.tf                  Least-privilege IAM user for GitHub Actions
│   └── outputs.tf                   ECR URL, ALB DNS, CloudFront domain, S3, IAM user
├── .github/
│   └── workflows/
│       ├── ci.yml                   Typecheck + lint + Docker smoke test
│       ├── deploy-server.yml        Server deploy pipeline
│       └── deploy-client.yml        Client deploy pipeline
├── Dockerfile                       Multi-stage build (Node 26, tsc via tsconfig.json, npm ci)
└── .dockerignore
```
