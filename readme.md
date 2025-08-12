# BoostPub Monitor

Un système de monitoring et contrôle automatisé pour BoostPub avec surveillance CPU/RAM et nettoyage de sessions Chrome Puppeteer.

## 🚀 Fonctionnalités

- **Surveillance en temps réel** : Monitoring CPU et RAM de l'application BoostPub
- **Watchdog automatique** : Actions correctives automatiques (redémarrage, nettoyage)
- **Nettoyage de sessions** : Suppression automatique des sessions Chrome orphelines
- **Alertes HTTP** : Notifications automatiques en cas de dépassement de seuils
- **Logs structurés** : Système de logging complet avec niveaux et horodatage
- **Configuration flexible** : Variables d'environnement pour tous les paramètres

## 📋 Prérequis

- Node.js 16+ 
- PM2 installé globalement
- cpulimit installé sur le système
- BoostPub en cours d'exécution via PM2

## 🛠️ Installation

1. **Cloner le projet**
```bash
git clone <repository-url>
cd boostpub-monitor
```

2. **Installer les dépendances**
```bash
npm install
# ou
yarn install
```

3. **Configurer l'environnement**
```bash
cp env.example.env
# Éditer .env avec vos paramètres
```

4. **Compiler le projet**
```bash
npm run build
```

## ⚙️ Configuration

Copiez `env.example` vers `.env` et configurez les variables :

```env
# Configuration BoostPub Monitor
APP_NAME=bpub-prod
CPU_LIMIT=50
CPU_THRESHOLD=80
RAM_THRESHOLD=450

# Endpoints
ALERT_ENDPOINT=https://ton-endpoint.com/api/alert
REPORT_ENDPOINT=

# Chemins
SESSIONS_PATH=/var/www/node-apps/boostpub-api/WH_SESSIONS/PROD
CHROME_PROCESS_NAME=chrome

# Logging
LOG_LEVEL=info
LOG_FILE=logs/boostpub-monitor.log

# Intervalles (en millisecondes)
WATCHDOG_INTERVAL=5000
MONITOR_INTERVAL=1000
```

### Variables de configuration

| Variable | Description | Défaut |
|----------|-------------|---------|
| `APP_NAME` | Nom de l'application PM2 à surveiller | `bpub-prod` |
| `CPU_LIMIT` | Limite CPU appliquée via cpulimit (%) | `50` |
| `CPU_THRESHOLD` | Seuil CPU pour déclencher les actions (%) | `80` |
| `RAM_THRESHOLD` | Seuil RAM pour déclencher les actions (MB) | `450` |
| `ALERT_ENDPOINT` | URL pour envoyer les alertes HTTP | - |
| `REPORT_ENDPOINT` | URL pour envoyer les rapports de nettoyage | - |
| `SESSIONS_PATH` | Chemin vers les sessions Chrome | `/var/www/node-apps/boostpub-api/WH_SESSIONS/PROD` |
| `CHROME_PROCESS_NAME` | Nom du processus Chrome | `chrome` |
| `LOG_LEVEL` | Niveau de log (debug, info, warn, error) | `info` |
| `LOG_FILE` | Fichier de log | `logs/boostpub-monitor.log` |
| `WATCHDOG_INTERVAL` | Intervalle de surveillance watchdog (ms) | `5000` |
| `MONITOR_INTERVAL` | Intervalle de monitoring temps réel (ms) | `1000` |

## 🚀 Utilisation

### Démarrage complet
```bash
# Mode production
npm start

# Mode développement
npm run dev
```

### Modules individuels

#### Watchdog (surveillance et actions)
```bash
# Production
npm run watchdog

# Développement
npm run watchdog:dev
```

#### Monitor (surveillance temps réel)
```bash
# Production
npm run monitor

# Développement
npm run monitor:dev
```

#### Cleaner (nettoyage sessions)
```bash
# Production
npm run clean

# Développement
npm run clean:dev
```

### Options de démarrage

Le contrôleur principal accepte des options en ligne de commande :

```bash
# Démarrer sans watchdog
npm run dev -- --no-watchdog

# Démarrer sans monitor
npm run dev -- --no-monitor

# Exécuter le nettoyage au démarrage
npm run dev -- --cleanup

# Mode monitor uniquement
npm run dev -- --monitor-only
```

## 📊 Fonctionnalités détaillées

### Watchdog
- Surveille l'usage CPU et RAM de BoostPub
- Applique automatiquement une limite CPU via `cpulimit`
- Redémarre l'application si les seuils sont dépassés
- Tue les processus Chrome Puppeteer orphelins
- Envoie des alertes HTTP en cas d'action

### Monitor
- Affichage en temps réel des statistiques système
- Historique des mesures (1000 dernières entrées)
- Calcul de moyennes sur période
- Interface console claire et informative

### Cleaner
- Détection des sessions Chrome orphelines
- Suppression automatique des dossiers de sessions
- Rapport détaillé des actions effectuées
- Envoi de rapports HTTP (optionnel)

## 📁 Structure du projet

```
boostpub-monitor/
├── src/
│   ├── config.ts          # Configuration centralisée
│   ├── logger.ts          # Système de logging
│   ├── utils.ts           # Fonctions utilitaires
│   ├── watchdog.ts        # Surveillance et actions
│   ├── cleaner.ts         # Nettoyage des sessions
│   ├── monitor.ts         # Monitoring temps réel
│   ├── controller.ts      # Contrôleur principal
│   ├── watchdog-cli.ts    # CLI watchdog
│   ├── cleaner-cli.ts     # CLI cleaner
│   └── monitor-cli.ts     # CLI monitor
├── dist/                  # Fichiers compilés
├── logs/                  # Fichiers de logs
├── .env                   # Variables d'environnement
├── env.example           # Exemple de configuration
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Développement

### Compilation
```bash
npm run build
```

### Mode développement
```bash
npm run dev
```

### Tests
```bash
npm test
```

## 📝 Logs

Les logs sont écrits à la fois dans la console et dans le fichier configuré (`logs/boostpub-monitor.log` par défaut).

### Niveaux de log
- `DEBUG` : Informations détaillées pour le débogage
- `INFO` : Informations générales
- `WARN` : Avertissements
- `ERROR` : Erreurs

### Format des logs
```
[2024-01-15T10:30:45.123Z] [INFO] [WATCHDOG] CPU=75% RAM=400MB
```

## 🚨 Alertes

Le système envoie des alertes HTTP POST en cas de dépassement de seuils :

```json
{
  "app": "bpub-prod",
  "cpu": 85,
  "ram_mb": 500,
  "time": "2024-01-15T10:30:45.123Z",
  "action": "restart"
}
```

## 🔍 Dépannage

### Problèmes courants

1. **Application PM2 non trouvée**
   - Vérifiez que l'application est démarrée via PM2
   - Vérifiez le nom de l'application dans la configuration

2. **Erreurs de permissions**
   - Vérifiez les permissions sur le répertoire des sessions
   - Assurez-vous que l'utilisateur peut exécuter `cpulimit`

3. **Logs non écrits**
   - Vérifiez les permissions sur le répertoire `logs/`
   - Vérifiez l'espace disque disponible

### Commandes utiles

```bash
# Vérifier le statut PM2
pm2 status

# Voir les logs PM2
pm2 logs bpub-prod

# Vérifier les processus Chrome
ps aux | grep chrome

# Vérifier l'espace disque
df -h
```

## 📄 Licence

ISC

## 🤝 Contribution

1. Fork le projet
2. Créez une branche pour votre fonctionnalité
3. Committez vos changements
4. Poussez vers la branche
5. Ouvrez une Pull Request

## 📞 Support

Pour toute question ou problème, veuillez ouvrir une issue sur le repository.
