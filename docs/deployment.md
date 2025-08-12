# Guide de déploiement - BoostPub Monitor

## Prérequis système

### Système d'exploitation
- Linux (Ubuntu 18.04+, CentOS 7+, Debian 9+)
- macOS (pour le développement)
- Windows avec WSL2 (pour le développement)

### Logiciels requis
- Node.js 16.0.0 ou supérieur
- npm 8.0.0 ou supérieur (ou yarn)
- PM2 (gestionnaire de processus)
- cpulimit (limitation CPU)

### Permissions
- Accès root ou sudo pour l'installation de cpulimit
- Permissions d'écriture sur le répertoire des logs
- Permissions d'exécution sur les commandes PM2

## Installation des dépendances

### 1. Node.js et npm

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Vérification
node --version
npm --version
```

### 2. PM2

```bash
# Installation globale
sudo npm install -g pm2

# Vérification
pm2 --version
```

### 3. cpulimit

```bash
# Ubuntu/Debian
sudo apt-get install cpulimit

# CentOS/RHEL
sudo yum install cpulimit

# Vérification
cpulimit --version
```

## Installation du projet

### 1. Clonage et installation

```bash
# Cloner le repository
git clone <repository-url>
cd boostpub-monitor

# Installer les dépendances
npm install

# Compiler le projet
npm run build
```

### 2. Configuration

```bash
# Copier le fichier d'exemple
cp env.example.env

# Éditer la configuration
nano .env
```

### 3. Création des répertoires

```bash
# Créer le répertoire des logs
mkdir -p logs

# Vérifier les permissions
chmod 755 logs
```

## Configuration de l'environnement

### Variables d'environnement critiques

```env
# Application à surveiller
APP_NAME=bpub-prod

# Seuils de surveillance
CPU_THRESHOLD=80
RAM_THRESHOLD=450

# Endpoints d'alerte
ALERT_ENDPOINT=https://votre-endpoint.com/api/alert

# Chemins système
SESSIONS_PATH=/var/www/node-apps/boostpub-api/WH_SESSIONS/PROD
```

### Validation de la configuration

```bash
# Tester la configuration
npm run dev -- --monitor-only
```

## Déploiement avec PM2

### 1. Configuration PM2

Créer un fichier `ecosystem.config.js` :

```javascript
module.exports = {
  apps: [{
    name: 'boostpub-monitor',
    script: 'dist/controller.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    env_production: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_file: 'logs/pm2-combined.log',
    time: true
  }]
};
```

### 2. Démarrage avec PM2

```bash
# Démarrage en mode production
pm2 start ecosystem.config.js --env production

# Vérification du statut
pm2 status

# Voir les logs
pm2 logs boostpub-monitor
```

### 3. Gestion du service

```bash
# Redémarrer
pm2 restart boostpub-monitor

# Arrêter
pm2 stop boostpub-monitor

# Supprimer
pm2 delete boostpub-monitor

# Sauvegarder la configuration
pm2 save

# Configurer le démarrage automatique
pm2 startup
```

## Déploiement en mode développement

### 1. Mode développement direct

```bash
# Démarrer en mode développement
npm run dev

# Démarrer avec options spécifiques
npm run dev -- --monitor-only
npm run dev -- --no-watchdog
```

### 2. Modules individuels

```bash
# Watchdog uniquement
npm run watchdog:dev

# Monitor uniquement
npm run monitor:dev

# Nettoyage des sessions
npm run clean:dev
```

## Surveillance et maintenance

### 1. Logs et monitoring

```bash
# Voir les logs en temps réel
tail -f logs/boostpub-monitor.log

# Voir les logs PM2
pm2 logs boostpub-monitor

# Vérifier l'espace disque
df -h

# Vérifier l'utilisation mémoire
free -h
```

### 2. Tests de fonctionnement

```bash
# Test du watchdog
npm run watchdog:dev

# Test du monitor
npm run monitor:dev

# Test du nettoyage
npm run clean:dev
```

### 3. Vérification des processus

```bash
# Vérifier PM2
pm2 status

# Vérifier les processus Chrome
ps aux | grep chrome

# Vérifier cpulimit
ps aux | grep cpulimit
```

## Sécurité

### 1. Permissions des fichiers

```bash
# Répertoire du projet
chmod 755 /path/to/boostpub-monitor

# Fichier de configuration
chmod 600 .env

# Répertoire des logs
chmod 755 logs/
```

### 2. Utilisateur dédié (recommandé)

```bash
# Créer un utilisateur dédié
sudo useradd -r -s /bin/false boostpub-monitor

# Changer la propriété
sudo chown -R boostpub-monitor:boostpub-monitor /path/to/boostpub-monitor

# Démarrer avec l'utilisateur dédié
pm2 start ecosystem.config.js --uid boostpub-monitor
```

### 3. Firewall

```bash
# Autoriser les connexions sortantes pour les alertes HTTP
sudo ufw allow out 80/tcp
sudo ufw allow out 443/tcp
```

## Sauvegarde et récupération

### 1. Sauvegarde de la configuration

```bash
# Sauvegarder la configuration
cp .env .env.backup

# Sauvegarder les logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/
```

### 2. Récupération

```bash
# Restaurer la configuration
cp .env.backup .env

# Redémarrer le service
pm2 restart boostpub-monitor
```

## Mise à jour

### 1. Processus de mise à jour

```bash
# Sauvegarder la configuration actuelle
cp .env .env.backup

# Arrêter le service
pm2 stop boostpub-monitor

# Mettre à jour le code
git pull origin main

# Installer les nouvelles dépendances
npm install

# Recompiler
npm run build

# Restaurer la configuration
cp .env.backup .env

# Redémarrer le service
pm2 start boostpub-monitor
```

### 2. Vérification post-mise à jour

```bash
# Vérifier le statut
pm2 status

# Vérifier les logs
pm2 logs boostpub-monitor

# Tester les fonctionnalités
npm run monitor:dev
```

## Dépannage

### Problèmes courants

#### 1. Application PM2 non trouvée
```bash
# Vérifier que l'application existe
pm2 list

# Vérifier le nom dans la configuration
cat .env | grep APP_NAME
```

#### 2. Erreurs de permissions
```bash
# Vérifier les permissions
ls -la logs/
ls -la .env

# Corriger les permissions
chmod 755 logs/
chmod 600 .env
```

#### 3. cpulimit non trouvé
```bash
# Vérifier l'installation
which cpulimit

# Réinstaller si nécessaire
sudo apt-get install cpulimit
```

#### 4. Logs non écrits
```bash
# Vérifier l'espace disque
df -h

# Vérifier les permissions
ls -la logs/

# Vérifier les logs PM2
pm2 logs boostpub-monitor
```

### Commandes de diagnostic

```bash
# Statut complet du système
pm2 status
pm2 logs boostpub-monitor
df -h
free -h
ps aux | grep -E "(chrome|cpulimit|node)"

# Test de connectivité
curl -I $ALERT_ENDPOINT

# Vérification de la configuration
npm run dev -- --monitor-only
```

## Performance et optimisation

### 1. Ajustement des intervalles

```env
# Intervalles recommandés
WATCHDOG_INTERVAL=5000    # 5 secondes
MONITOR_INTERVAL=1000     # 1 seconde
```

### 2. Limitation des ressources

```javascript
// Dans ecosystem.config.js
max_memory_restart: '512M',
max_restarts: 10,
```

### 3. Rotation des logs

```bash
# Configuration logrotate
sudo nano /etc/logrotate.d/boostpub-monitor

# Contenu du fichier
/path/to/boostpub-monitor/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 boostpub-monitor boostpub-monitor
}
```

## Support et maintenance

### Contacts
- **Développeur** : [Votre email]
- **Documentation** : [Lien vers la documentation]
- **Issues** : [Lien vers le repository]

### Procédures d'urgence

#### Arrêt d'urgence
```bash
pm2 stop boostpub-monitor
pkill -f "chrome.*WH_SESSIONS"
```

#### Redémarrage complet
```bash
pm2 delete boostpub-monitor
pm2 start ecosystem.config.js --env production
```
