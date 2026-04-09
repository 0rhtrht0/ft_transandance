# Contributor: tmory

## Role: Technical Lead & Backend Architecture

tmory designed the backbone of the Blackhole system, focusing on real-time reliability and relational consistency.

### Key Contributions
- **System Architecture**: Led the design of the FastAPI backend and defined the core communication patterns (REST + WebSockets).
- **Real-time Engine**: Implemented the WebSocket manager that handles live chat delivery and game state synchronization.
- **Database Scaling**: Designed the relational schema to handle complex multi-user interactions and progression history.
- **Microservice Integration**: Stabilized the interaction between the Python backend and the various infrastructure components (Caddy, Postgres).

### Technical Focus
- Real-time signaling logic.
- Asynchronous Python (FastAPI/Starlette).
- Database migrations and SQLAlchemy modeling.

### AI Usage
- Assisted in architecting complex WebSocket event types.
- Used for reviewing critical code paths for data consistency.
