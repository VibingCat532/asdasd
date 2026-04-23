# HoodStories Rekrutacje - Node.js Backend

Node.js/Express backend for HoodStories recruitment system, compatible with Vercel deployment.

## Features

- ✅ Discord OAuth2 authentication
- ✅ JWT session management
- ✅ PostgreSQL/NeonDB database integration
- ✅ Recruitment CRUD operations
- ✅ Application submission and tracking
- ✅ Staff dashboard and application review
- ✅ Role-based access control
- ✅ Question management
- ✅ Vercel serverless ready

## Tech Stack

- **Framework**: Express.js (Node.js)
- **Database**: PostgreSQL (NeonDB on production)
- **Authentication**: JWT + Discord OAuth2
- **ORM**: pg (node-postgres)
- **Deployment**: Vercel

## Project Structure

```
src/
├── server.js              # Main Express application
├── db/
│   ├── index.js          # Database pool and initialization
│   └── schema.sql        # Database schema definition
├── routes/
│   ├── auth.js           # Authentication endpoints
│   ├── recruitments.js    # Public recruitment endpoints
│   ├── applications.js    # Application endpoints
│   └── staff.js          # Staff/admin endpoints
├── utils/
│   ├── logger.js         # Logging utility
│   ├── auth.js           # JWT utilities
│   ├── discord.js        # Discord API integration
│   └── roles.js          # Role-based access control
└── middleware/           # Express middleware
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 12+ (or NeonDB account)
- Discord Developer Application

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file (copy from `.env.example`):

```env
DATABASE_URL=postgresql://user:password@localhost/dbname
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_BOT_TOKEN=your_bot_token
JWT_SECRET=your_secret_here
DISCORD_REDIRECT_URI=http://localhost:3001/api/auth/discord/callback
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
NODE_ENV=development
PORT=3001
```

### Running

**Development**:
```bash
npm run dev
# Uses nodemon for auto-restart
```

**Production**:
```bash
npm start
```

**Database Migration**:
```bash
npm run migrate
```

## API Endpoints

### Auth Routes

```
GET  /api/auth/config-status          - Check configuration
GET  /api/auth/discord/start           - Start OAuth flow
GET  /api/auth/discord/callback        - OAuth callback
GET  /api/auth/me                      - Get current user
POST /api/auth/logout                  - Logout
GET  /api/auth/roles-info              - Get role information
```

### Public Recruitment Routes

```
GET  /api/recruitments                 - List all recruitments
GET  /api/recruitments/:id             - Get recruitment details
POST /api/recruitments/:id/apply       - Submit application
```

### Application Routes (Authenticated)

```
GET  /api/applications                 - List my applications
GET  /api/applications/:id             - Get application details
```

### Staff Routes (Authenticated)

```
GET    /api/staff/me                                      - Get capabilities
GET    /api/staff/recruitments                           - List accessible
POST   /api/staff/recruitments                           - Create recruitment
GET    /api/staff/recruitments/:id                       - Get details
PATCH  /api/staff/recruitments/:id                       - Update recruitment
DELETE /api/staff/recruitments/:id                       - Delete recruitment
POST   /api/staff/recruitments/:id/questions             - Update questions
GET    /api/staff/recruitments/:id/applications          - List applications
GET    /api/staff/recruitments/:id/applications/:appId   - Get application
PATCH  /api/staff/recruitments/:id/applications/:appId/status - Update status
```

## Database

### Schema

Tables:
- `users` - User profiles (Discord linked)
- `discord_oauth_tokens` - OAuth tokens and refresh tokens
- `recruitments` - Recruitment postings
- `recruitment_questions` - Questions for each recruitment
- `applications` - User applications
- `application_answers` - Individual answers to questions
- `recruitment_access` - Staff access grants

### Initialization

Schema is automatically created on first run via `initSchema()` function in `db/index.js`.

## Authentication

### Discord OAuth2 Flow

1. User clicks "Login with Discord"
2. Frontend redirects to `/api/auth/discord/start`
3. Backend generates state token, stores in cookie
4. User authorizes on Discord
5. Discord redirects to `/api/auth/discord/callback`
6. Backend validates state, exchanges code for tokens
7. Backend creates/updates user in database
8. Backend issues JWT and sets HTTP-only cookie
9. User is logged in

### JWT Tokens

- Issued on successful OAuth
- Stored in HTTP-only cookie named `hs_session`
- Expires in 24 hours
- Validated on protected endpoints

## Role-Based Access Control

User roles from Discord:
- `management` (Role ID: 1495819852097786098)
- `opiekun_administracji` (Role ID: 1495819597180567633)
- `opiekun` (Role ID: 1495821859575304392)
- `accepted_adm` (Role ID: 1495819785215414272)

Permissions:
- **Management**: Full access to all recruitments
- **Opiekun**: Can create 1 recruitment, manage own
- **Opiekun Administracji**: Limited scope

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `DISCORD_CLIENT_ID` | Discord app ID | `123456789...` |
| `DISCORD_CLIENT_SECRET` | Discord app secret | `abc123...` |
| `DISCORD_BOT_TOKEN` | Discord bot token | `MTk4NjIyNDczOTI5MTkyNzY4...` |
| `JWT_SECRET` | JWT signing secret | Random string (min 32 chars) |
| `DISCORD_REDIRECT_URI` | OAuth callback URL | `https://app.com/api/auth/discord/callback` |
| `FRONTEND_URL` | Frontend base URL | `https://app.com` |
| `CORS_ORIGINS` | Allowed origins | `https://app.com,https://www.app.com` |
| `NODE_ENV` | Environment | `production` or `development` |
| `PORT` | Server port | `3001` |

## Error Handling

All errors return JSON responses:

```json
{
  "error": "Error message",
  "status": 400
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not found
- `409` - Conflict
- `422` - Validation error
- `500` - Server error
- `503` - Service unavailable

## Deployment to Vercel

See [../DEPLOYMENT_VERCEL.md](../DEPLOYMENT_VERCEL.md) for complete instructions.

Key points:
1. Set all environment variables in Vercel project settings
2. Vercel automatically runs `npm install` and `npm start`
3. Database must be accessible from Vercel servers
4. Cold starts are normal for serverless - optimize with connection pooling

## Development Tips

### Testing Endpoints

```bash
# Test config
curl http://localhost:3001/api/auth/config-status

# Get current user
curl -b "hs_session=TOKEN" http://localhost:3001/api/auth/me

# List recruitments
curl http://localhost:3001/api/recruitments
```

### Debugging

Enable debug logging:
```bash
DEBUG=* npm run dev
```

Check database connections:
```bash
psql $DATABASE_URL
```

### Performance

- Connection pool defaults to 5 connections max
- Adjust `max` in `src/db/index.js` if needed
- Use connection pooling for serverless (Vercel)

## Security

- ✅ HTTP-only cookies for JWT
- ✅ CSRF protection via state token
- ✅ Input validation
- ✅ SQL injection protection (parameterized queries)
- ✅ CORS configured
- ✅ Role-based access control
- ✅ Rate limiting recommended (add express-rate-limit)

## License

MIT

## Support

For issues, see [../README.md](../README.md)
