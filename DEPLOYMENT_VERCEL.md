# HoodStories Rekrutacje - Vercel Deployment Guide

## Overview

Ta aplikacja składa się z:
- **Frontend**: React.js (statyczne pliki) 
- **Backend**: Node.js/Express (API serverless functions)
- **Database**: NeonDB (PostgreSQL na chmurze)

Cała aplikacja jest teraz skonfigurowana do wdrażania na Vercel.

## Architektura

```
┌─────────────────────────────────────────────────────┐
│                    VERCEL                           │
├──────────────────┬──────────────────────────────────┤
│   Frontend       │      Backend API                 │
│   React.js       │      Express.js (Serverless)     │
│   Static Build   │      Endpoints: /api/*           │
└──────────────────┴──────────────────────────────────┘
         │                      │
         └──────────┬───────────┘
                    │
            ┌───────▼────────┐
            │    NeonDB      │
            │  PostgreSQL    │
            └────────────────┘
```

## Wymagania wstępne

1. **Konto Vercel**: https://vercel.com
2. **Konto NeonDB**: https://neon.tech
3. **Aplikacja Discord OAuth**: https://discord.com/developers/applications
4. **Git repository**: Wysłane do GitHub

## Krok 1: Przygotowanie NeonDB

### 1.1 Utwórz projekt na NeonDB

1. Przejdź do https://neon.tech i zaloguj się
2. Kliknij "New Project"
3. Wybierz región (np. US East)
4. Czekaj na inicjalizację

### 1.2 Skopiuj connection string

1. W panelu projektu, przejdź do "Connection Details"
2. Skopiuj connection string (CONNECTION_STRING lub URI)
3. Powinno wyglądać: `postgresql://user:password@ep-xxxxx.us-east-1.aws.neon.tech/dbname?sslmode=require`

## Krok 2: Konfiguracja Discord OAuth

### 2.1 Przygotuj adresy callback

Będziesz potrzebować dwóch URL-i Discord redirect:
- **Development**: `http://localhost:3001/api/auth/discord/callback`
- **Production** (Vercel): `https://your-app.vercel.app/api/auth/discord/callback`

### 2.2 Skonfiguruj aplikację Discord

1. Przejdź do https://discord.com/developers/applications
2. Otwórz istniejącą aplikację lub utwórz nową
3. Przejdź do "OAuth2" → "Redirects"
4. Dodaj redirect URLs (zarówno localhost jak i Vercel URL)
5. Skopiuj:
   - **Client ID**
   - **Client Secret**
   - **Bot Token** (z zakładki "Bot")

## Krok 3: Wdrażanie na Vercel

### 3.1 Inicjalna konfiguracja

1. Wyślij kod do GitHub repo
2. Przejdź do https://vercel.com/dashboard
3. Kliknij "Add New..." → "Project"
4. Zaimportuj GitHub repo

### 3.2 Konfiguracja zmiennych środowiskowych

W panelu Vercel, przejdź do Settings → Environment Variables i dodaj:

```
DATABASE_URL = postgresql://user:password@ep-xxxxx.us-east-1.aws.neon.tech/dbname?sslmode=require
DISCORD_CLIENT_ID = your_discord_client_id
DISCORD_CLIENT_SECRET = your_discord_client_secret
DISCORD_BOT_TOKEN = your_discord_bot_token
DISCORD_REDIRECT_URI = https://your-app.vercel.app/api/auth/discord/callback
JWT_SECRET = your_random_jwt_secret (min 32 znaki)
FRONTEND_URL = https://your-app.vercel.app
CORS_ORIGINS = https://your-app.vercel.app
NODE_ENV = production
```

### 3.3 Deploy

1. Kliknij "Deploy"
2. Czekaj na build i deployment
3. Po ukończeniu, skopiuj domeny URL

### 3.4 Aktualizuj Discord OAuth

Wróć do aplikacji Discord i dodaj finalny redirect URL:
```
https://your-app.vercel.app/api/auth/discord/callback
```

## Krok 4: Testowanie

### 4.1 Sprawdź konfigurację API

```bash
curl https://your-app.vercel.app/api/auth/config-status
```

Powinna zwrócić JSON z statusem konfiguracji.

### 4.2 Testuj Discord OAuth

1. Otwórz aplikację w przeglądarce: `https://your-app.vercel.app`
2. Kliknij "Login with Discord"
3. Autoryzuj aplikację
4. Powinieneś być zalogowany

### 4.3 Testuj aplikacje

1. Przejdź do dostępnych rekrutacji
2. Spróbuj przesłać aplikację
3. Sprawdź status w "My Applications"

## Localne Development

### Setup lokalny

```bash
# 1. Clone repo
git clone https://github.com/yourusername/your-repo.git
cd your-repo

# 2. Zainstaluj zależności
npm install
cd backend-node && npm install
cd ../frontend && npm install

# 3. Utwórz .env w backend-node/
cp backend-node/.env.example backend-node/.env
# Edytuj backend-node/.env z lokalnymi wartościami

# 4. Utwórz .env.local w frontend/
cp frontend/.env.example frontend/.env.local
# Frontend może używać: REACT_APP_BACKEND_URL=http://localhost:3001
```

### Uruchomienie aplikacji lokalnie

Terminal 1 - Backend:
```bash
cd backend-node
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm start
```

Aplikacja powinna być dostępna na `http://localhost:3000`

## Struktura projektu

```
your-repo/
├── backend-node/          # Node.js/Express backend
│   ├── src/
│   │   ├── server.js      # Main Express app
│   │   ├── db/            # Database config & schema
│   │   ├── routes/        # API route handlers
│   │   ├── utils/         # Helper functions
│   │   └── middleware/    # Express middleware
│   ├── package.json
│   └── .env.example
├── frontend/              # React.js frontend
│   ├── src/
│   ├── package.json
│   └── .env.example
├── vercel.json           # Vercel configuration
└── README.md
```

## Zmienne Środowiskowe - Szczegółowo

| Zmienna | Opis | Przykład |
|---------|------|---------|
| DATABASE_URL | Connection string do NeonDB | `postgresql://user:password@...` |
| DISCORD_CLIENT_ID | ID aplikacji Discord | `1234567890` |
| DISCORD_CLIENT_SECRET | Secret aplikacji Discord | `abc123...` |
| DISCORD_BOT_TOKEN | Token bota Discord | `MTk4NjIyNDczOTI5MTkyNzY4.Clwa7A...` |
| DISCORD_REDIRECT_URI | OAuth callback URL | `https://app.vercel.app/api/auth/discord/callback` |
| JWT_SECRET | Secret do JWT tokens | `random_long_string_of_at_least_32_chars` |
| FRONTEND_URL | URL frontendu (dla redirectów) | `https://app.vercel.app` |
| CORS_ORIGINS | Allowed CORS origins | `https://app.vercel.app` |
| NODE_ENV | Environment (production/development) | `production` |

## Troubleshooting

### Problem: "Discord OAuth not configured"

**Rozwiązanie**: Sprawdź czy wszystkie zmienne Discord są ustawione w Vercel settings.

### Problem: "Database unavailable"

**Rozwiązanie**: 
1. Sprawdź czy DATABASE_URL jest poprawny
2. Sprawdź czy NeonDB projekt jest aktywny
3. Sprawdź czy firewall/IP whitelist zezwala na połączenia z Vercel

### Problem: "Invalid state" przy Discord login

**Rozwiązanie**: 
1. Sprawdź czy DISCORD_REDIRECT_URI jest dokładnie taki sam w Discord dashboard
2. Wyczyść cookies przeglądarki
3. Spróbuj zalogować się ponownie

### Problem: CORS errors

**Rozwiązanie**: Sprawdź czy CORS_ORIGINS zawiera prawidłową domenę Vercel aplikacji.

## Security Best Practices

1. **JWT_SECRET**: Użyj losowego ciągu znaków (min 32 znaki)
   ```bash
   openssl rand -base64 32
   ```

2. **Database**: NeonDB automatycznie szyfruje SSL - zawsze używaj `?sslmode=require`

3. **Discord Secret**: Nigdy nie udostępniaj publicznie - przechowuj w Vercel secrets

4. **Environment variables**: Nie commituj `.env` plikow do Git

5. **CORS**: W production, nie używaj `*` - specyfikuj dokładne domeny

## Monitoring i Logs

### Sprawdź Vercel logs

```bash
vercel logs --follow
```

### Sprawdź NeonDB logs

Dashboard NeonDB → Activity/Logs

### Monitoruj errory

W aplikacji frontend, możesz dodać error reporting (np. Sentry).

## Migration z Python backendu (jeśli potrzeba)

Kod Node.js backend zawiera wszystkie endpointy z Python wersji:

- ✅ Discord OAuth2 auth
- ✅ JWT token management
- ✅ Recruitment CRUD
- ✅ Application submission & review
- ✅ Staff dashboard
- ✅ Role-based access control
- ✅ Question management

## Następne kroki

1. **Custom domain**: W Vercel, dodaj custom domain
2. **Monitoring**: Skonfiguruj error tracking (Sentry, LogRocket)
3. **Backups**: Skonfiguruj backups NeonDB
4. **CI/CD**: Vercel automatycznie deployuje na każdy push do main

## Support i Dokumentacja

- **Vercel Docs**: https://vercel.com/docs
- **NeonDB Docs**: https://neon.tech/docs
- **Express.js**: https://expressjs.com
- **React**: https://react.dev

---

**Utworzono**: 2024
**Ostatnia aktualizacja**: 2026
