# AWS Deployment Cost Estimate

This document outlines the expected monthly costs for running the ShopMind platform on AWS. We provide two tiers: a **Startup/Hackathon** tier (which fits mostly within the AWS Free Tier) and a **Production-Ready** tier.

---

## Tier 1: Startup / MVP (100% Free via AWS Free Tier)
*Recommended for initial launch, hackathons, and testing with $0 budget.*

In this setup, the entire Docker Compose stack (FastAPI, React, PostgreSQL, Redis) runs on a single AWS EC2 instance. We have specifically optimized the deployment script (`deploy_aws_ec2.sh`) to automatically configure a 2GB Virtual Swap File so that this heavy stack can run smoothly on a free 1GB instance.

| Service | Configuration | Estimated Monthly Cost | Notes |
|---------|--------------|------------------------|-------|
| **Compute (EC2)** | `t2.micro` (1 vCPU, 1 GiB RAM) | **$0.00** | 750 hours/month free for 12 months under AWS Free Tier. Swap file prevents out-of-memory errors. |
| **Storage (EBS)** | 20 GB gp3 | **$0.00** | Up to 30GB is included for free under AWS Free Tier. |
| **Data Transfer** | Outbound internet traffic | **$0.00** | First 100GB/month is free. |
| **AI LLM API** | Google Gemini 1.5 Flash/Pro | **$0.00** | Gemini provides a generous free tier (up to 15 RPM for Pro, 15 RPM for Flash). |
| **Total Estimated** | | **$0.00 / month** | *Zero cost for the first 12 months on a new AWS account.* |

---

## Tier 2: Production-Ready (Fully Managed AWS Architecture)
*Recommended for scaling to thousands of daily active users.*

In this setup, services are decoupled into AWS managed services for high availability, automated backups, and scalability.

| Service | Configuration | Estimated Monthly Cost | Notes |
|---------|--------------|------------------------|-------|
| **Frontend Hosting** | AWS Amplify or S3 + CloudFront | ~$2.00 | Highly cached static asset delivery globally. |
| **Backend Compute** | AWS App Runner or ECS Fargate | ~$25.00 | Serverless containers, scales up based on traffic automatically. |
| **Database (RDS)** | RDS PostgreSQL `db.t4g.micro` Multi-AZ | ~$28.00 | Automated backups, point-in-time recovery, high availability. |
| **Cache (ElastiCache)**| ElastiCache for Redis `cache.t4g.micro` | ~$12.00 | Dedicated in-memory data store for sessions and Celery. |
| **Networking** | VPC, NAT Gateway, Load Balancers | ~$35.00 | Required for secure private subnets for RDS/Redis. |
| **AI LLM API** | Google Gemini (Pay-as-you-go) | ~$10.00+ | Depends heavily on token volume and Agent Execution frequency. |
| **Total Estimated** | | **~$112.00 / month** | *Production baseline.* |

## Optimization Strategies

1. **Auto-Stopping:** If using Tier 1 for development, use AWS Instance Scheduler to turn the EC2 instance off at night (saves ~50% compute costs).
2. **Spot Instances:** For background Celery workers, use EC2 Spot Instances for an 80% discount.
3. **LLM Caching:** Cache common AI responses in Redis (e.g., standard SEO product descriptions) to avoid hitting the Gemini API repeatedly for identical prompts.
