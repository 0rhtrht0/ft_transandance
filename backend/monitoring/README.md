# Monitoring Stack

La stack de monitoring est lancee avec `make docker-up`.

Services exposes:
- Prometheus: `http://127.0.0.1:9090`
- Prometheus via Caddy: `https://localhost:8443/prometheus/`
- Grafana via Caddy: `https://localhost:8443/grafana/`
- Alertmanager via Caddy: `https://localhost:8443/alertmanager/`
- Mailpit: `http://127.0.0.1:8025`

Identifiants Grafana:
- utilisateur: `admin`
- mot de passe: `admin` par defaut, ou surcharge via `backend/.env.monitoring.example`

Composants inclus:
- Prometheus pour la collecte
- `postgres-exporter` pour PostgreSQL
- `blackbox-exporter` pour les probes HTTP
- Dashboards Grafana provisionnes automatiquement
- Regles d'alerte Prometheus pour backend, probe HTTP et exporter PostgreSQL
- Alertmanager pour l'acheminement des alertes
- Notifications email locales routees vers Mailpit

Remote mode:
- Frontend Vite direct: `http://IP_DU_SERVEUR:5173`
- Acces HTTPS via Caddy: `https://IP_DU_SERVEUR:8443`
- Prometheus via Caddy: `https://IP_DU_SERVEUR:8443/prometheus/`
- Grafana via Caddy: `https://IP_DU_SERVEUR:8443/grafana/`
- Alertmanager via Caddy: `https://IP_DU_SERVEUR:8443/alertmanager/`

Notifications:
- Les alertes Prometheus sont envoyees a Alertmanager.
- Alertmanager envoie les emails vers Mailpit (`monitoring@blackhole.local`) pour les tests locaux.
- Les messages recus sont visibles dans Mailpit sur `http://127.0.0.1:8025`.

Persistance:
- Les donnees PostgreSQL sont stockees dans `backend/data/postgres`.
- Les avatars uploades restent dans `backend/python/uploaded_avatars`.
- Si tu redemarres les conteneurs ou si tu copies le projet sur un autre poste avec ces dossiers, comptes, messages et profils sont conserves.
