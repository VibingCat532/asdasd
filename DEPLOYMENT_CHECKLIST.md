# Checklist - Vercel Deployment

## Pre-Deployment Checklist

### Przygotowanie Bazy Danych
- [ ] Konto NeonDB utworzone (https://neon.tech)
- [ ] Projekt NeonDB utworzony
- [ ] CONNECTION_STRING skopiowany
- [ ] Backup bazy (Settings → Backups)

### Przygotowanie Discord OAuth
- [ ] Aplikacja Discord istnieje (https://discord.com/developers)
- [ ] Discord Client ID skopiowany
- [ ] Discord Client Secret skopiowany
- [ ] Discord Bot Token skopiowany
- [ ] OAuth2 Scopes ustawione (identify, guilds.join)

### Przygotowanie Kodu
- [ ] Kod wysłany do GitHub
- [ ] Wszystkie pliki commitowane (git status = clean)
- [ ] Brak .env plików w repo (dodane do .gitignore)

### Przygotowanie Vercel
- [ ] Konto Vercel utworzone (https://vercel.com)
- [ ] GitHub account połączony
- [ ] Repo zaimportowany do Vercel

## Environment Variables Checklist

### W Vercel Settings → Environment Variables dodane:

- [ ] DATABASE_URL=`postgresql://...?sslmode=require`
- [ ] DISCORD_CLIENT_ID=`your_id`
- [ ] DISCORD_CLIENT_SECRET=`your_secret`
- [ ] DISCORD_BOT_TOKEN=`your_token`
- [ ] JWT_SECRET=`random_32+_chars`
- [ ] DISCORD_REDIRECT_URI=`https://your-app.vercel.app/api/auth/discord/callback`
- [ ] FRONTEND_URL=`https://your-app.vercel.app`
- [ ] CORS_ORIGINS=`https://your-app.vercel.app`
- [ ] NODE_ENV=`production`

**Przydatna rada**: Skopiuj wartości z `.env.example` pliku i wypełnij je.

## Deployment Checklist

### Krok 1: Vercel Import
- [ ] Projekt wybrany z GitHub
- [ ] Framework auto-detektuje się jako React

### Krok 2: Environment Variables
- [ ] Wszystkie zmienne dodane w Vercel
- [ ] Żadne zmienne nie zawierają spacji
- [ ] DATABASE_URL z `?sslmode=require`

### Krok 3: Deploy
- [ ] Kliknięty "Deploy"
- [ ] Build uruchomił się bez błędów
- [ ] Skopiuj finalne URL z wiadomości (np. `your-app.vercel.app`)

### Krok 4: Discord Settings Update
- [ ] Przejdziesz do Discord Developer Portal
- [ ] Dodałeś nowy Redirect URI: `https://your-app.vercel.app/api/auth/discord/callback`
- [ ] Zapisał zmiany

## Post-Deployment Testing

### Testy API

```bash
# Test 1: Health Check
curl https://your-app.vercel.app/health
# Powinna zwrócić: {"status":"ok","timestamp":"..."}

# Test 2: Config Status
curl https://your-app.vercel.app/api/auth/config-status
# Powinna zwrócić: {"all_required_set":true,...}

# Test 3: List Recruitments
curl https://your-app.vercel.app/api/recruitments
# Powinna zwrócić: JSON z listą rekrutacji
```

### Testy UI

- [ ] Przejdź na https://your-app.vercel.app
- [ ] Strona się ładuje (nie 502/503)
- [ ] Klikniesz "Login with Discord"
- [ ] Zostaniesz przekierowany do Discord OAuth
- [ ] Autoryzujesz aplikację
- [ ] Zostaniesz zalogowany (widzisz profil)
- [ ] Widzisz listę rekrutacji
- [ ] Możesz kliknąć na rekrutację
- [ ] Możesz przejść na "My Applications"

### Testy Funkcjonalności

- [ ] Discord login działa ✓
- [ ] Recruitments się ładują ✓
- [ ] Aplikacja submission działa (jeśli możliwe) ✓
- [ ] Staff dashboard widoczny (jeśli jesteś staffem) ✓
- [ ] Logout działa ✓
- [ ] Refresh strony nie wylogowuje (session preserved) ✓

## Troubleshooting - Szybka Naprawa

| Problem | Rozwiązanie |
|---------|-------------|
| 502 Bad Gateway | Czekaj 5 min, jeśli dalej - sprawdź logs: `vercel logs` |
| Discord OAuth error | Sprawdź DISCORD_REDIRECT_URI w Discord settings i Vercel env vars |
| Database unavailable | Sprawdź DATABASE_URL, czy NeonDB projekt jest aktywny |
| CORS errors | Sprawdź CORS_ORIGINS w Vercel - musi zawierać domenę Vercel |
| Aplikacja się nie buduje | `vercel logs` - sprawdź error messages |
| Stare aplikacje nie widać | Logika jest prawidłowa - usuń cookies i zaloguj się ponownie |

## Monitorowanie

### Weryfikuj regularnie:

Codziennie:
- [ ] Aplikacja się ładuje
- [ ] Nie ma 500 errors w Vercel logs
- [ ] Nie ma warning'ów w Vercel

Co tydzień:
- [ ] Backup NeonDB wykonany
- [ ] Sprawdzam error tracking (jeśli skonfigurowany)
- [ ] Sprawdzam performance metrics

## Rollback Plan (jeśli coś pójdzie źle)

1. [ ] Vercel: Przejdź do Deployments
2. [ ] Kliknij strzałkę przy poprzedniej wersji
3. [ ] Kliknij "Redeploy"
4. [ ] Gotowe - poprzednia wersja jest live

**WAŻNE**: Baza danych jest niezmienna - nie ulegnie cofnięciu!

## Finalny Checklist Przed Wypuszczeniem do Użytkowników

- [ ] Wszystkie testy przejdły
- [ ] Backup bazy wykonany
- [ ] Dokumentacja zapoznana
- [ ] Team poinformowany o zmianie
- [ ] Plan komunikacji z użytkownikami (re-login wymagany)
- [ ] Monitoring ustawiony
- [ ] Support plan gotowy (jeśli coś się zepsuje)

## Linki Szybkiego Dostępu

- **Vercel Dashboard**: https://vercel.com/dashboard
- **NeonDB Console**: https://console.neon.tech
- **Discord Developer Portal**: https://discord.com/developers/applications
- **GitHub Repo**: [Twój URL repo]
- **Live App**: https://your-app.vercel.app

## Notes / Uwagi

```
Wpisz tutaj swoje notatki lub przypomnienia:
_________________________________________
_________________________________________
_________________________________________
```

---

**Status**: ☐ W trakcie  ☐ Gotowe ✓

**Data**: ___________

**Osoba odpowiedzialna**: ___________
