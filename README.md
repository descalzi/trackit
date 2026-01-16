# TrackIt - Package Tracking Application

TrackIt is a full-stack package tracking application that allows users to track packages from multiple couriers including Evri, Royal Mail, DPD, and many more using the Ship24 API.

## Tech Stack

### Backend
- **FastAPI** (Python 3.12) - Modern async web framework
- **SQLAlchemy** - ORM for database operations
- **SQLite** - Lightweight database
- **Ship24 API** - Multi-courier package tracking
- **Google OAuth + JWT** - User authentication
- **Uvicorn** - ASGI server

### Frontend
- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool
- **Material-UI (MUI)** - Component library
- **React Router** - Client-side routing
- **Google OAuth** - Social login

### Deployment
- **Docker** - Containerization
- **Nginx** - Reverse proxy & static file serving
- **Docker Compose** - Multi-container orchestration

## Features

- 🔐 **Google OAuth Authentication** - Secure login with Google
- 📦 **Multi-Courier Support** - Track packages from 1,500+ couriers via Ship24
- 💾 **Save & Monitor Packages** - Save tracking numbers for easy monitoring
- 🔄 **Manual Refresh** - Update tracking status on demand
- 📱 **Responsive Design** - Works on mobile and desktop
- 🏷️ **Custom Nicknames** - Add friendly names to your packages
- 📝 **Package Notes** - Add descriptions for organization
- 📚 **Archive System** - Archive delivered packages

## Project Structure

```
trackit/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/               # API routers
│   │   │   ├── auth.py        # Authentication endpoints
│   │   │   ├── packages.py    # Package CRUD
│   │   │   └── tracking.py    # Ship24 tracking
│   │   ├── services/
│   │   │   ├── auth_service.py      # Auth logic
│   │   │   └── ship24_service.py    # Ship24 API client
│   │   ├── database.py        # SQLAlchemy models
│   │   ├── models.py          # Pydantic schemas
│   │   └── main.py            # FastAPI app
│   └── requirements.txt
│
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── api/               # API client
│   │   ├── components/        # React components
│   │   ├── contexts/          # React contexts
│   │   ├── hooks/             # Custom hooks
│   │   ├── pages/             # Page components
│   │   ├── theme/             # MUI theme
│   │   ├── types/             # TypeScript types
│   │   ├── utils/             # Utilities
│   │   ├── App.tsx            # Main app component
│   │   └── main.tsx           # Entry point
│   └── package.json
│
├── Dockerfile                  # Multi-stage Docker build
├── docker-compose.yml          # Container orchestration
└── nginx.conf                  # Nginx configuration
```

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- pnpm
- Docker & Docker Compose (for deployment)

### Environment Variables

Create `.env` file in the project root:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# JWT Secret
SECRET_KEY=your-secret-key

# Ship24 API
SHIP24_API_KEY=your-ship24-api-key
```

### Development Setup

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8006
```

Backend will be available at http://localhost:8006

#### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Frontend will be available at http://localhost:8080

### Docker Deployment

```bash
docker compose up -d --build
```

Application will be available at:
- Development: http://localhost:8084
- Production: https://your-domain.com/trackit

## API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8006/docs
- ReDoc: http://localhost:8006/redoc

## Database Schema

### Users
- Google OAuth user information
- JWT tokens

### Packages
- Tracking number
- Courier information
- Nickname & description
- Ship24 tracker ID (cached)
- Last status & location
- Archived flag

### Tracking Events
- Package tracking history
- Status updates
- Location checkpoints
- Timestamps

## Ship24 Integration

TrackIt uses Ship24 API for multi-courier tracking:
- Free tier: 100 API calls OR 10 shipments/month
- Supports 1,500+ couriers worldwide
- Caching strategy to minimize API calls

## License

MIT License

## Support

For issues or questions, please open an issue on GitHub.
