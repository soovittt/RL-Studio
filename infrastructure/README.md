# RL Studio Infrastructure

This directory contains documentation for RL Studio's AWS infrastructure.

## 🚀 S3 Bucket Setup

S3 bucket setup is handled directly in the backend code using `rl_studio.utils.s3_bucket_setup`.

The bucket is created automatically when needed, or can be set up manually using the backend utilities.

## ⚠️ IMPORTANT: Uses Credentials from .env

**All infrastructure scripts use credentials from `.env` file, NOT your default AWS profile.**

The scripts will:
1. Load credentials from `backend/.env` or `backend/tokens/prod.txt` or `backend/tokens/dev.txt`
2. Use those credentials explicitly (not default AWS profile)
3. Create resources in the AWS account associated with those credentials

## Prerequisites

1. **AWS Credentials in .env file**
   - Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `backend/.env`
   - Or in `backend/tokens/prod.txt` or `backend/tokens/dev.txt`
   - Set `AWS_DEFAULT_REGION` (default: `us-east-1`)
   - Set `S3_BUCKET_NAME` (default: `rl-studio-rollouts`)

## What Gets Created

- **S3 Bucket**: `rl-studio-rollouts` (or your custom name)
  - Versioning enabled
  - Server-side encryption (AES256)
  - Public access blocked
  - Lifecycle policy (auto-delete after 365 days)

- **IAM User**: `rl-studio-rollouts-service-user`
  - Policy attached for S3 bucket access
  - Access keys for backend service

- **IAM Policy**: Allows:
  - `s3:GetObject` - Read rollouts
  - `s3:PutObject` - Save rollouts
  - `s3:DeleteObject` - Delete rollouts
  - `s3:ListBucket` - List rollouts

## Configuration

Set in `backend/.env`:

```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=us-east-1
S3_BUCKET_NAME=rl-studio-rollouts
```

## Security Notes

1. **IAM Credentials**: The IAM user access key is only shown once. Save it securely!
2. **Bucket Policy**: Only authenticated users with the IAM policy can access the bucket
3. **Public Access**: All public access is blocked
4. **Encryption**: All data is encrypted at rest (AES256)
5. **Credentials**: Uses `.env` file credentials, NOT default AWS profile

## Troubleshooting

### Bucket already exists
The script will detect if the bucket already exists and skip creation.

### Permission denied
Ensure your AWS credentials in `.env` have:
- `s3:CreateBucket`
- `s3:PutBucketVersioning`
- `s3:PutBucketEncryption`
- `s3:PutBucketPublicAccessBlock`
- `s3:PutBucketLifecycleConfiguration`
- `iam:CreateUser`
- `iam:PutUserPolicy`
- `iam:CreateAccessKey`

### Wrong AWS account
**Make sure your `.env` file has the correct AWS credentials!**
The scripts use credentials from `.env`, not your default AWS profile.

### Region mismatch
Ensure `AWS_DEFAULT_REGION` in `.env` matches your credentials region.
Default: `us-east-1`

## Backend Utilities

S3 bucket creation is handled by `backend/rl_studio/utils/s3_bucket_setup.py`:
- `create_rollout_bucket()` - Creates S3 bucket and IAM resources
- `verify_bucket_access()` - Verifies bucket access with current credentials
