# AWS deployment guide

This is a deployment checklist and configuration starting point, not an account-specific Terraform stack. Choose the AWS region, availability zones, domain, instance sizes, backup windows, and scaling strategy for the target workload.

## Network and database

1. Create a VPC spanning at least two availability zones, with public subnets for the load-facing EC2 instance (or load balancer) and private subnets for RDS.
2. Create an RDS PostgreSQL instance in a DB subnet group using private subnets. Disable public accessibility, enable encryption at rest, automated backups, and deletion protection for production.
3. Create separate security groups:
   - Application ingress: allow TCP 80/443 from the internet or, preferably, from an HTTPS load balancer security group. Allow TCP 22 only from a trusted administrator/VPN address if SSH is needed.
   - Database ingress: allow TCP 5432 only from the application instance security group. Do not add a public CIDR rule.
4. Create a dedicated PostgreSQL role and database for FoodHub. Grant only the permissions required by the application and migrations; keep migration privileges separate from runtime privileges where operationally practical.
5. Store the production database URL and a newly generated JWT signing key in AWS Systems Manager Parameter Store (SecureString) or Secrets Manager. Attach a least-privilege instance profile that permits reading only those named secrets. Do not put AWS keys or application secrets in the AMI, repository, user data, or frontend environment.

## EC2 application host

1. Launch a supported Linux EC2 instance in a public subnet, attach the application security group and a narrowly scoped IAM instance profile, and use encrypted storage with routine patching.
2. Create a dedicated `foodhub` Linux user. Place the app under `/opt/foodhub`, install Python 3.11+, Node.js 20+ (build the client during release), Nginx, and a Python virtual environment.
3. Build the frontend in CI or on the deployment host and publish `frontend/dist/` to `/var/www/foodhub`. Configure `VITE_API_BASE_URL` to the public same-origin `/api` path for production, then rebuild.
4. Install backend dependencies and write `/etc/foodhub/backend.env` with `APP_ENV=production`, the private RDS `DATABASE_URL`, a random `JWT_SECRET_KEY`, `JWT_ALGORITHM=HS256`, an appropriate token lifetime, and the production CORS origin list. Restrict this file to root and the service account; prefer retrieving values from AWS secret storage at deployment/startup.
5. Run `alembic upgrade head` as a controlled release step with migration credentials. Start the API with the supplied `foodhub-api.service` and enable it with systemd.
6. Install `deployment/nginx/foodhub.conf` in Nginx, replace the example server name, and serve the Vite build. Terminate TLS with an ACM-backed load balancer or configure a managed certificate on the host; redirect HTTP to HTTPS and enable HSTS only after HTTPS is verified.
7. Restrict CORS to the actual application origin, configure log rotation and monitoring, and verify `/health`, `/docs` policy, login, ordering, and database connectivity before opening traffic.

## Release and operations

- Deploy immutable releases from GitHub using a CI identity with least privilege; do not use a developer's long-lived AWS access key on the instance.
- Back up RDS and test restores. Apply migrations before switching traffic to code that requires the new schema; keep a rollback plan for both application and schema changes.
- Monitor EC2, RDS, disk, application logs, and error rates. Alert on failed health checks and exhausted database connections.
- The sample Nginx config leaves FastAPI's interactive docs available through the API upstream. Disable or restrict `/docs` and `/openapi.json` in production if they should not be public.

