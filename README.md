# HoodStories Rekrutacje

A full-stack recruitment management system with Discord OAuth integration, built for Vercel and NeonDB.

## 🎯 Features

- ✅ Discord OAuth2 authentication
- ✅ Recruitment posting and management
- ✅ Application submission and tracking
- ✅ Staff dashboard with review capabilities
- ✅ Role-based access control (Discord roles)
- ✅ PostgreSQL with NeonDB integration
- ✅ Vercel deployment ready
- ✅ Fully responsive design

## 🏗️ Architecture

```
┌────────────────────┐
│  React Frontend    │  Vercel Static
│  (frontend/)       │
└────────────────────┘
         │
         │ (HTTP)
         ▼
┌────────────────────┐
│ Node.js Backend    │  Vercel Serverless
│ (backend-node/)    │
└────────────────────┘
         │
         │ (TCP)
         ▼
┌────────────────────┐
│ NeonDB PostgreSQL  │  Cloud Database
└────────────────────┘
```

## 📖 Documentation

- **[Local Development Setup](./SETUP_LOCAL.md)** - Run locally for development
- **[Vercel Deployment Guide](./DEPLOYMENT_VERCEL.md)** - Deploy to production
- **[Backend API Documentation](./backend-node/README.md)** - API reference

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install && cd backend-node && npm install && cd ../frontend && npm install

# Backend - Terminal 1
cd backend-node
npm run dev

# Frontend - Terminal 2
cd frontend
npm start
```

See [SETUP_LOCAL.md](./SETUP_LOCAL.md) for detailed instructions.

### Deploy to Vercel

```bash
# Push to GitHub
git push origin main

# Deploy via Vercel
vercel
```

See [DEPLOYMENT_VERCEL.md](./DEPLOYMENT_VERCEL.md) for complete guide.

## 📦 Project Structure

```
your-repo/
├── frontend/              # React.js application
│   ├── public/           # Static files
│   ├── src/
│   │   ├── pages/       # Page components
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom React hooks
│   │   └── App.js       # Main app
│   ├── package.json
│   └── .env.example
│
├── backend-node/         # Express.js API
│   ├── src/
│   │   ├── db/         # Database
│   │   ├── routes/     # API endpoints
│   │   ├── utils/      # Utilities
│   │   └── server.js   # Main server
│   ├── package.json
│   └── .env.example
│
├── vercel.json          # Vercel configuration
├── SETUP_LOCAL.md       # Local setup guide
├── DEPLOYMENT_VERCEL.md # Vercel deployment guide
└── README.md            # This file
```

## 🔗 API Endpoints

### Authentication
- `GET /api/auth/config-status` - Configuration status
- `GET /api/auth/discord/start` - Start OAuth flow
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Recruitments
- `GET /api/recruitments` - List all
- `GET /api/recruitments/:id` - Get details
- `POST /api/recruitments/:id/apply` - Submit application

### Applications
- `GET /api/applications` - My applications
- `GET /api/applications/:id` - Application details

### Staff
- `GET /api/staff/me` - Staff capabilities
- `GET /api/staff/recruitments` - Accessible recruitments
- `POST /api/staff/recruitments` - Create recruitment
- `PATCH /api/staff/recruitments/:id` - Update recruitment
- `GET /api/staff/recruitments/:id/applications` - List applications
- `PATCH /api/staff/recruitments/:id/applications/:appId/status` - Update status

## ⚙️ Required Environment Variables

### Backend (backend-node/.env)
```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_BOT_TOKEN=your_bot_token
JWT_SECRET=your_jwt_secret
DISCORD_REDIRECT_URI=https://your-domain.com/api/auth/discord/callback
FRONTEND_URL=https://your-domain.com
CORS_ORIGINS=https://your-domain.com
NODE_ENV=production
```

### Frontend (frontend/.env.local)
```
REACT_APP_BACKEND_URL=https://your-domain.com
```

See `.env.example` files for complete examples.

## 🔐 Security

- HTTP-only JWT cookies
- CSRF protection via state tokens
- Parameterized SQL queries
- Role-based access control
- CORS configuration
- Input validation

## 🛠️ Tech Stack

### Frontend
- React 18
- Tailwind CSS
- Radix UI components
- Axios for API calls

### Backend
- Express.js (Node.js)
- node-postgres (pg)
- jsonwebtoken (JWT)
- Discord.js for OAuth

### Database
- PostgreSQL (NeonDB)
- Automatic schema initialization

### Deployment
- Vercel (frontend & backend)
- NeonDB (database)
- Discord OAuth

## 📚 Database Schema

Tables:
- `users` - User profiles
- `discord_oauth_tokens` - OAuth tokens
- `recruitments` - Recruitment postings
- `recruitment_questions` - Questions per recruitment
- `applications` - User applications
- `application_answers` - Question answers
- `recruitment_access` - Staff access control

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/description`
2. Commit changes: `git commit -m "Add description"`
3. Push to branch: `git push origin feature/description`
4. Open a Pull Request

## 📝 License

MIT

## 🆘 Support

For issues or questions:
1. Check the documentation files
2. Review the API endpoints
3. Check environment variables
4. Enable debug logging
5. Open a GitHub issue

## 📞 Getting Help

- **Local issues**: See [SETUP_LOCAL.md](./SETUP_LOCAL.md)
- **Deployment issues**: See [DEPLOYMENT_VERCEL.md](./DEPLOYMENT_VERCEL.md)
- **API issues**: See [backend-node/README.md](./backend-node/README.md)
