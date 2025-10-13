# Deployment Guide - Render.com

## Overview
This guide helps you deploy your webhook management system to Render.com without Kafka (simplified architecture for MVP).

**Cost**:
- Free tier: $0 (with cold starts after 15min inactivity)
- Paid tier: $14/month ($7 backend + $7 PostgreSQL)

---

## What About Kafka?

### Kafka Options:

1. **Without Kafka (Recommended for MVP)** - Current setup
   - Deploy to Render.com now
   - Webhooks delivered directly from API
   - Works for < 1000 req/min
   - Cost: $0-14/month

2. **With Kafka (Production Scale)**
   - **CloudKarafka**: $9-99/month for managed Kafka
   - **Upstash Kafka**: $0.20 per 100k messages
   - **DigitalOcean Droplet**: $12/month (self-host Kafka)
   - **AWS MSK**: $72/month minimum

**Recommendation**: Start without Kafka on Render.com, add Kafka later when you need:
- > 10,000 events/day
- Guaranteed message ordering
- Event replay capability
- Multiple event consumers

---

## Prerequisites

1. GitHub account
2. Render.com account (free signup)
3. Git installed locally

---

## Step 1: Push Code to GitHub

```bash
cd /Users/sobhan/Claud/FAMILY-ACTIVITY-DEMO

# Initialize git if not done
git init
git add .
git commit -m "Initial commit - webhook management system"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/webhook-system.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy on Render.com

### A. Create Account & Connect GitHub
1. Go to https://render.com
2. Sign up with GitHub
3. Authorize Render to access your repo

### B. Create New Blueprint
1. Click "New" → "Blueprint"
2. Select your GitHub repo
3. Render will detect `render.yaml` automatically
4. Click "Apply"

### C. Configure Environment Variables (Optional)
Render will auto-configure database connection. You can add:
- `SMTP_HOST` - for email (optional)
- `SMTP_PORT` - 587
- `SMTP_USER` - your SMTP username
- `SMTP_PASSWORD` - your SMTP password

### D. Deploy
- Render will automatically:
  - Create PostgreSQL database
  - Deploy Python backend
  - Deploy React frontend
  - Set up SSL certificates
  - Configure custom domains (if added)

---

## Step 3: Run Database Migrations

After first deployment:

1. Go to your backend service in Render dashboard
2. Click "Shell" tab
3. Run migrations:

```bash
# Connect to database
psql $DATABASE_URL

# Run migrations (paste each one)
\i database/migrations/001_initial_schema.sql
\i database/migrations/002_add_admin_users.sql
\i database/migrations/003_add_security_questions.sql
\i database/migrations/004_add_schema_fields.sql
\i database/migrations/005_add_events_deliveries.sql
\i database/migrations/006_add_subscribers.sql
\i database/migrations/007_seed_data.sql
\i database/migrations/008_add_subscriber_id_to_admins.sql

# Exit
\q
```

Or use the migration script:
```bash
python3 -c "
import os
import psycopg2

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

migrations = [
    '001_initial_schema.sql',
    '002_add_admin_users.sql',
    '003_add_security_questions.sql',
    '004_add_schema_fields.sql',
    '005_add_events_deliveries.sql',
    '006_add_subscribers.sql',
    '007_seed_data.sql',
    '008_add_subscriber_id_to_admins.sql'
]

for migration in migrations:
    with open(f'database/migrations/{migration}') as f:
        cur.execute(f.read())
    print(f'Applied {migration}')

conn.commit()
cur.close()
conn.close()
"
```

---

## Step 4: Access Your Application

After deployment completes:

- **Frontend**: https://webhook-frontend.onrender.com
- **Backend API**: https://webhook-backend.onrender.com
- **Health Check**: https://webhook-backend.onrender.com/health

Default login:
- Email: admin@webhook.com
- Password: admin123

**⚠️ Change default password immediately!**

---

## Step 5: Custom Domain (Optional)

1. In Render dashboard, go to your frontend service
2. Click "Settings" → "Custom Domain"
3. Add your domain (e.g., webhooks.yourdomain.com)
4. Update DNS with provided CNAME record
5. SSL certificate auto-provisioned

---

## Upgrading to Paid Tier

To remove cold starts:

1. Go to each service in Render
2. Click "Settings" → "Instance Type"
3. Change from "Free" to "Starter" ($7/month each)

---

## Adding Kafka Later

When you're ready to scale:

### Option 1: CloudKarafka (Easiest)
```bash
# Add to render.yaml
- key: KAFKA_BROKERS
  value: your-cloudkarafka-url.com:9094
- key: KAFKA_USERNAME
  value: your-username
- key: KAFKA_PASSWORD
  value: your-password
```

### Option 2: Self-Host on DigitalOcean
1. Create $12/month droplet
2. Install Docker & Kafka
3. Point backend to Kafka URL

---

## Monitoring & Logs

- **Logs**: Render dashboard → Service → "Logs" tab
- **Metrics**: Render dashboard → Service → "Metrics" tab
- **Alerts**: Set up in Render dashboard → "Notifications"

---

## Troubleshooting

### Build Fails
- Check Python version in `runtime.txt`
- Verify all dependencies in `requirements.txt`

### Database Connection Error
- Verify migrations ran successfully
- Check DATABASE_URL in environment variables

### Frontend Can't Reach Backend
- Update VITE_API_URL in frontend env vars
- Check CORS settings in backend

### Cold Starts (Free Tier)
- Upgrade to paid tier ($7/month)
- Or ping health endpoint every 10 minutes

---

## Cost Breakdown

### Free Tier (with limitations)
- PostgreSQL: Free (90 days, then $7/month)
- Backend: Free (spins down after 15min)
- Frontend: Free (always on)
- **Total**: $0-7/month

### Paid Tier (production-ready)
- PostgreSQL: $7/month
- Backend: $7/month
- Frontend: Free
- **Total**: $14/month

### With Kafka (future)
- Base: $14/month
- CloudKarafka: +$9/month
- **Total**: $23/month

---

## Next Steps

1. ✅ Deploy to Render.com
2. ✅ Run database migrations
3. ✅ Test all endpoints
4. ⬜ Add custom domain
5. ⬜ Set up monitoring
6. ⬜ Add Kafka when needed
