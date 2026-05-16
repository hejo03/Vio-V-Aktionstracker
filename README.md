# Vio-V Aktionstracker

Eine Web-App zum Tracken von Gang-Aktionen im Online-Spiel **Vio-V**. Sie verbindet sich über OAuth2 mit der Vio-V API, überwacht automatisch Gangwar-Gebiete bzw. Fabriken und sendet Echtzeit-Benachrichtigungen per Discord.

**Features:**

- Aktionsverwaltung mit Punktesystem und Auszahlungsberechnung
- Automatische Überwachung von Gangwar-Angriffen (jede Minute) via Cron
- Speicher-Gewichtsalarm bei >80 % Auslastung (stündlich)
- Discord-Webhooks für Kampfmeldungen und Benachrichtigungen
- Rollen- & Rechteverwaltung für Gang-Mitglieder
- OAuth2 PKCE Login über Vio-V

---

## Voraussetzungen

- [Node.js](https://nodejs.org/) ≥ 22
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- [Docker & Docker Compose](https://docs.docker.com/get-docker/) (für die Datenbank bzw. den Produktivbetrieb)
- Ein Vio-V OAuth2-App-Eintrag (`CLIENT_ID` + `CLIENT_SECRET`)
- Einen Discord-Server mit zwei Webhooks (Log + Benachrichtigung)

---

## Installation

### 1. Repository klonen

```bash
git clone https://github.com/hejo03/Vio-V-Aktionstracker.git
cd Vio-V-Aktionstracker
```

### 2. Abhängigkeiten installieren

```bash
pnpm install
```

### 3. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
```

Dann `.env` befüllen:

| Variable                 | Beschreibung                                          |
| ------------------------ | ----------------------------------------------------- |
| `NODE_ENV`               | `development` oder `production`                       |
| `PORT`                   | HTTP-Port der App (Standard: `3000`)                  |
| `DOMAIN`                 | Öffentliche Domain (z. B. `tracker.example.com`)      |
| `CLIENT_ID`              | Vio-V OAuth2 Client ID                                |
| `CLIENT_SECRET`          | Vio-V OAuth2 Client Secret                            |
| `DB_USERNAME`            | MySQL-Benutzername                                    |
| `DB_PASSWORD`            | MySQL-Passwort                                        |
| `DB_DATABASE`            | Datenbankname (Standard: `tracker`)                   |
| `DB_HOST`                | Datenbank-Host (Standard: `mysql-db-tracker`)         |
| `DB_PORT`                | Datenbank-Port (Standard: `3306`)                     |
| `VIO_GROUP_ID`           | Numerische Gruppen-ID eurer Gang/Squad (steht im UCP) |
| `GANG_NAME`              | Anzeigename der Gang                                  |
| `GROUP_TYPE`             | `gang` oder `squad`                                   |
| `DISCORD_WEBHOOK`        | Webhook-URL für Betriebslogs                          |
| `NOTIFY_DISCORD_WEBHOOK` | Webhook-URL für Kampfbenachrichtigungen               |
| `DC_PING_ROLE`           | Discord Rollen-ID für @-Pings                         |
| `CUSTOM_ATTACK_MESSAGE`  | Optionaler Text für Angriffspings                     |

---

## Lokale Entwicklung

Datenbank starten:

```bash
docker-compose up -d mysql-db-tracker
```

App mit Auto-Reload starten:

```bash
pnpm dev
```

Die App ist unter `http://localhost:3000` erreichbar. Die Datenbanktabellen werden beim ersten Start automatisch erstellt (Sequelize `sync`).

---

## Produktivbetrieb (Docker)

Das `docker-compose.yml` startet drei Services: die App hinter Traefik, die MySQL-Datenbank und einen automatischen Backup-Container (täglich 3 Uhr, 3 Versionen).

Voraussetzung: ein laufendes Traefik-Setup mit einem externen Docker-Netzwerk namens `web`.

```bash
docker-compose up -d
```

Die App wird dann unter `https://<DOMAIN>` erreichbar (TLS via Traefik). Logs:

```bash
docker-compose logs -f tracker
```

---

## Projektstruktur

```
├── bin/www               # Einstiegspunkt, DB-Sync, Crons
├── app.js                # Express-App, Middleware
├── config.js             # Alle Umgebungsvariablen zentral
├── controllers/          # Request-Handler
├── helpers/
│   ├── vioHandler.js     # Vio-V API Client (OAuth2, Token-Refresh)
│   ├── crons.js          # Cron-Jobs (Angriffe, Speicher)
│   ├── authentification.js # Auth-Middleware
│   └── utility.js        # Discord-Webhooks, Logging
├── models/               # Sequelize-Modelle (User, Role, Operation …)
├── routes/               # Express-Routen
└── views/                # Handlebars-Templates
```
