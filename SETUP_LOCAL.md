# HoodStories Rekrutacje - Local Development Setup

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL (or NeonDB)
- Discord application (for OAuth)

### Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd your-repo

# 2. Install dependencies
npm install

# Install backend dependencies
cd backend-node
npm install
cd ..

# Install frontend dependencies  
cd frontend
npm install
cd ..
```

### Configuration

#### Backend Setup

```bash
# Copy example env file
cp backend-node/.env.example backend-node/.env

# Edit backend-node/.env with your values:
# - DATABASE_URL: PostgreSQL/NeonDB connection string
# - DISCORD_CLIENT_ID: From Discord Developer Portal
# - DISCORD_CLIENT_SECRET: From Discord Developer Portal
# - DISCORD_BOT_TOKEN: From Discord Developer Portal
# - JWT_SECRET: Random secret (min 32 chars)
# - DISCORD_REDIRECT_URI: http://localhost:3001/api/auth/discord/callback
```

#### Frontend Setup

```bash
# Copy example env file
cp frontend/.env.example frontend/.env.local

# The frontend uses default backend URL: http://localhost:3001
# Update if needed
```

### Running Locally

**Terminal 1 - Start Backend**:
```bash
cd backend-node
npm run dev
# Server runs on http://localhost:3001
```

**Terminal 2 - Start Frontend**:
```bash
cd frontend
npm start
# App opens on http://localhost:3000
```

### Testing

1. Open http://localhost:3000
2. Click "Login with Discord"
3. Authorize the application
4. You should be logged in
5. Browse recruitments and test the application flow

## Project Structure

```
├── backend-node/           # Node.js/Express backend
│   ├── src/
│   │   ├── db/            # Database configuration
│   │   ├── routes/        # API routes
│   │   ├── utils/         # Utilities (auth, Discord, roles)
│   │   ├── middleware/    # Express middleware
│   │   └── server.js      # Main server file
│   ├── package.json
│   └── .env.example
├── frontend/              # React application
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom React hooks
│   │   └── App.js        # Main app component
│   ├── package.json
│   └── .env.example
├── DEPLOYMENT_VERCEL.md   # Vercel deployment guide
└── README.md              # This file
```

## Environment Variables

### Backend (backend-node/.env)

```
DATABASE_URL=postgresql://user:pass@localhost/dbname
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_BOT_TOKEN=your_bot_token
JWT_SECRET=your_jwt_secret
DISCORD_REDIRECT_URI=http://localhost:3001/api/auth/discord/callback
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
NODE_ENV=development
```

### Frontend (frontend/.env.local)

```
REACT_APP_BACKEND_URL=http://localhost:3001
```

## API Endpoints

### Authentication
- `GET /api/auth/config-status` - Check config
- `GET /api/auth/discord/start` - Start Discord OAuth
- `GET /api/auth/discord/callback` - OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `GET /api/auth/roles-info` - Get role info

### Recruitments
- `GET /api/recruitments` - List all
- `GET /api/recruitments/:id` - Get details
- `POST /api/recruitments/:id/apply` - Submit application

### Applications
- `GET /api/applications` - List my applications
- `GET /api/applications/:id` - Get application details

### Staff Routes
- `GET /api/staff/me` - Get capabilities
- `GET /api/staff/recruitments` - List accessible recruitments
- `POST /api/staff/recruitments` - Create recruitment
- `GET /api/staff/recruitments/:id` - Get recruitment details
- `PATCH /api/staff/recruitments/:id` - Update recruitment
- `DELETE /api/staff/recruitments/:id` - Delete recruitment
- `POST /api/staff/recruitments/:id/questions` - Update questions
- `GET /api/staff/recruitments/:id/applications` - List applications
- `GET /api/staff/recruitments/:id/applications/:appId` - Get application
- `PATCH /api/staff/recruitments/:id/applications/:appId/status` - Update status

## Database Schema

The application uses PostgreSQL with tables:
- `users` - User accounts
- `discord_oauth_tokens` - OAuth tokens
- `recruitments` - Recruitment postings
- `recruitment_questions` - Questions for each recruitment
- `applications` - User applications
- `application_answers` - Answers to applications
- `recruitment_access` - Staff access control

## Troubleshooting

### Port already in use
```bash
# Kill process using port 3001
lsof -ti:3001 | xargs kill -9

# Or use different port
PORT=3002 npm start
```

### Database connection failed
- Verify DATABASE_URL is correct
- Ensure PostgreSQL/NeonDB server is running
- Check firewall/network settings

### Discord OAuth not working
- Verify DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET
- Ensure DISCORD_REDIRECT_URI matches Discord app settings
- Check DISCORD_BOT_TOKEN is valid

### CORS errors
- Verify CORS_ORIGINS includes your frontend URL
- Frontend and backend must be on different ports for local dev

## Building for Production

### Backend
```bash
cd backend-node
npm install --production
# Server runs with: npm start
```

### Frontend
```bash
cd frontend
npm run build
# Creates production build in build/ directory
```

## Deployment

See [DEPLOYMENT_VERCEL.md](./DEPLOYMENT_VERCEL.md) for Vercel deployment instructions.

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Submit a pull request

## License

MIT

## Support

For issues or questions, open a GitHub issue.
