# Backend Workspace

Ce projet est pilote en mode Docker-first.

## Dossiers utiles

- `python/`: backend FastAPI actif.
- `monitoring/`: Prometheus, Grafana, Alertmanager et exporters.
- `data/postgres/`: donnees PostgreSQL persistantes.

## Persistance

- Les comptes, messages, parties et autres donnees PostgreSQL sont ecrits dans `backend/data/postgres`.
- Les avatars uploades restent dans `backend/python/uploaded_avatars`.
- Si tu relances les conteneurs ou si tu copies ces dossiers sur un autre poste, tes donnees restent disponibles.

## Lancement

```bash
make docker-up
```
