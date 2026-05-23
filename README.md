# IntelliStream

A full-stack trainee stream allocation platform. Trainee scores and DPI data are synced from the **IntelliStreamDeco** service, an allocation algorithm assigns streams based on configurable weights, and managers/admins can review, override, and freeze allocations through a React dashboard.

---

## Architecture

```
intellistream-frontend-V1   →   auth-service (FastAPI)   →   IntelliStreamDeco (Spring Boot)
      :5173                          :8000                             :8081
                                        ↕
                                   PostgreSQL
                                        ↕
                                   Ollama (AI)
```

| Service | Tech | Port |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind | 5173 |
| Auth / Allocation API | Python 3 + FastAPI + SQLAlchemy | 8000 |
| Deco Data Service | Java 21 + Spring Boot 3 + Maven | 8081 |

---

## Prerequisites

Make sure all of these are installed before you start:

- **Node.js** ≥ 20
- **Python** ≥ 3.11
- **Java** 21
- **Maven** 3.8+ (or use the bundled `mvnw`)
- **PostgreSQL** 14+
- **Ollama** — for AI recommendations ([install](https://ollama.com))

---

## 1. Database Setup

Create two PostgreSQL databases — one for each backend service:

```sql
CREATE DATABASE intellistream_auth;
CREATE DATABASE intellistream_deco;
```

> Both services will create their own tables on first run via auto-migration / JPA.

---

## 2. IntelliStreamDeco (Spring Boot — port 8081)

This is the data source service. The auth-service syncs trainee, DPI, and score data from it.

```bash
cd IntelliStreamDeco
```

Configure your database connection inside `src/main/resources/application.properties` (create it if it doesn't exist):

```properties
server.port=8081
spring.datasource.url=jdbc:postgresql://localhost:5432/intellistream_deco
spring.datasource.username=postgres
spring.datasource.password=your_password
spring.jpa.hibernate.ddl-auto=update
```

Run the service:

```bash
# Using the Maven wrapper (no Maven install required)
./mvnw spring-boot:run

# Or with Maven directly
mvn spring-boot:run
```

On Windows:

```bat
mvnw.cmd spring-boot:run
```

---

## 3. Auth Service (FastAPI — port 8000)

```bash
cd auth-service
```

**Create and activate a virtual environment:**

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

**Install dependencies:**

```bash
pip install -r requirements.txt
```

**Configure environment variables** — create a `.env` file in `auth-service/`:

```env
SECRET_KEY=your-secret-key-minimum-32-characters
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

DATABASE_URL=postgresql://postgres:your_password@localhost:5432/intellistream_auth

DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=Tcs#1234

SPRINGBOOT_BASE_URL=http://localhost:8081

DPI_WEIGHT=0.40
SCORE_WEIGHT=0.60

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gpt-oss:20b
OLLAMA_TIMEOUT=1800.0
```

**Start Ollama** (required for AI allocation recommendations):

```bash
ollama serve
ollama pull gpt-oss:20b   # or whichever model you configured
```

**Run the service:**

```bash
uvicorn main:app --reload --port 8000
```

On first startup the service will:
- Auto-create all database tables
- Seed the default admin user (`DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD`)
- Attempt an initial sync from IntelliStreamDeco

Interactive API docs are available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 4. Frontend (Vite — port 5173)

```bash
cd intellistream-frontend-V1
```

**Install dependencies:**

```bash
npm install
```

**Configure environment** — create a `.env` file in `intellistream-frontend-V1/`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

**Start the dev server:**

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Default Login

| Field | Value |
|---|---|
| Email | `admin@example.com` |
| Password | `Tcs#1234` |

> Change these in the auth-service `.env` before running in any shared environment.

---

## Running Everything Together

Open **three terminals** and run each service in order:

```bash
# Terminal 1 — Deco (Spring Boot)
cd IntelliStreamDeco && ./mvnw spring-boot:run

# Terminal 2 — Auth API (FastAPI)
cd auth-service && uvicorn main:app --reload --port 8000

# Terminal 3 — Frontend (Vite)
cd intellistream-frontend-V1 && npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).
