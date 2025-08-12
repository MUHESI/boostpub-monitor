# Architecture BoostPub Monitor

## Vue d'ensemble

BoostPub Monitor est conçu avec une architecture modulaire en TypeScript, permettant une maintenance facile et une extensibilité. Le système est organisé autour de plusieurs modules spécialisés qui communiquent via des interfaces bien définies.

## Architecture générale

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Controller    │    │    Watchdog     │    │    Monitor      │
│   (Orchestrator)│◄──►│  (Surveillance) │    │ (Temps réel)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Config      │    │     Utils       │    │     Logger      │
│ (Configuration) │    │ (Utilitaires)   │    │   (Logging)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│     Cleaner     │    │   CLI Modules   │
│  (Nettoyage)    │    │  (Interface)    │
└─────────────────┘    └─────────────────┘
```

## Modules détaillés

### 1. Controller (`src/controller.ts`)

**Responsabilité** : Orchestration et coordination de tous les modules

**Fonctionnalités** :
- Démarrage/arrêt des services
- Gestion des signaux système (SIGINT, SIGTERM)
- Validation de la configuration
- Gestion des erreurs globales
- Point d'entrée principal de l'application

**Interfaces** :
```typescript
interface StartupOptions {
  enableWatchdog?: boolean;
  enableMonitor?: boolean;
  runCleanup?: boolean;
  monitorOnly?: boolean;
}
```

### 2. Config (`src/config.ts`)

**Responsabilité** : Gestion centralisée de la configuration

**Fonctionnalités** :
- Chargement des variables d'environnement
- Validation des paramètres
- Valeurs par défaut
- Interface typée pour la configuration

**Structure** :
```typescript
interface MonitorConfig {
  app: {
    name: string;
    cpuLimit: number;
    cpuThreshold: number;
    ramThreshold: number;
  };
  endpoints: {
    alert: string;
    report: string;
  };
  paths: {
    sessions: string;
    chromeProcess: string;
  };
  logging: {
    level: string;
    file: string;
  };
  intervals: {
    watchdog: number;
    monitor: number;
  };
}
```

### 3. Logger (`src/logger.ts`)

**Responsabilité** : Système de logging centralisé

**Fonctionnalités** :
- Logging multi-niveaux (DEBUG, INFO, WARN, ERROR)
- Écriture console et fichier
- Horodatage automatique
- Formatage structuré
- Pattern Singleton

**Utilisation** :
```typescript
logger.info('MODULE', 'Message informatif');
logger.warn('MODULE', 'Avertissement', { data: 'contexte' });
logger.error('MODULE', 'Erreur', { error: 'détails' });
```

### 4. Utils (`src/utils.ts`)

**Responsabilité** : Fonctions utilitaires communes

**Fonctionnalités** :
- Exécution de commandes shell
- Gestion des processus PM2
- Surveillance des ressources système
- Actions correctives (cpulimit, redémarrage)
- Formatage de données

**Fonctions principales** :
- `runCommand(cmd: string): string`
- `getPM2PID(appName: string): string | null`
- `getProcessUsage(pid: string): SystemUsage | null`
- `applyCpuLimit(pid: string, limit: number): Promise<void>`
- `restartPM2App(appName: string): Promise<void>`

### 5. Watchdog (`src/watchdog.ts`)

**Responsabilité** : Surveillance et actions correctives automatiques

**Fonctionnalités** :
- Surveillance périodique des seuils CPU/RAM
- Application automatique de limites CPU
- Actions correctives (redémarrage, nettoyage)
- Envoi d'alertes HTTP
- Gestion des timers

**Cycle de vie** :
1. Récupération du PID de l'application
2. Mesure des ressources utilisées
3. Application de la limite CPU
4. Vérification des seuils
5. Actions correctives si nécessaire
6. Envoi d'alertes

### 6. Monitor (`src/monitor.ts`)

**Responsabilité** : Surveillance en temps réel et affichage

**Fonctionnalités** :
- Collecte de statistiques en temps réel
- Affichage console formaté
- Historique des mesures
- Calcul de moyennes
- Export de données

**Données collectées** :
- Usage CPU et RAM de l'application
- Statistiques système globales
- Historique avec timestamps

### 7. Cleaner (`src/cleaner.ts`)

**Responsabilité** : Nettoyage des sessions Chrome orphelines

**Fonctionnalités** :
- Détection des fichiers SingletonLock
- Identification des sessions actives
- Suppression des dossiers orphelins
- Génération de rapports
- Envoi de rapports HTTP

**Processus de nettoyage** :
1. Recherche des fichiers SingletonLock
2. Extraction des dossiers de sessions
3. Identification des profils Chrome actifs
4. Suppression des dossiers orphelins
5. Génération du rapport

## Flux de données

### Surveillance normale
```
Controller → Watchdog → Utils → PM2/System
                ↓
            Logger ← Alertes HTTP
```

### Monitoring temps réel
```
Controller → Monitor → Utils → PM2/System
                ↓
            Console ← Historique
```

### Nettoyage
```
Controller → Cleaner → Utils → Filesystem
                ↓
            Rapport ← HTTP (optionnel)
```

## Gestion des erreurs

### Stratégie générale
1. **Logging** : Toutes les erreurs sont loggées avec contexte
2. **Récupération** : Tentative de récupération automatique
3. **Alertes** : Notification en cas d'erreur critique
4. **Graceful degradation** : Continuation du service si possible

### Types d'erreurs
- **Erreurs de configuration** : Arrêt immédiat
- **Erreurs de surveillance** : Log et continuation
- **Erreurs d'action** : Retry et alerte
- **Erreurs système** : Log et récupération

## Sécurité

### Considérations
- Validation des chemins de fichiers
- Sanitisation des commandes shell
- Gestion des permissions
- Protection contre l'injection

### Bonnes pratiques
- Utilisation de `path.resolve()` pour les chemins
- Validation des entrées utilisateur
- Logging des actions sensibles
- Gestion des timeouts

## Performance

### Optimisations
- Utilisation de timers appropriés
- Limitation de la taille des historiques
- Gestion efficace de la mémoire
- Commandes shell optimisées

### Monitoring
- Surveillance des ressources du monitor lui-même
- Détection des fuites mémoire
- Optimisation des intervalles

## Extensibilité

### Points d'extension
- Nouveaux types d'alertes
- Modules de surveillance supplémentaires
- Actions correctives personnalisées
- Formats de rapport alternatifs

### Architecture modulaire
- Interfaces bien définies
- Couplage faible entre modules
- Injection de dépendances
- Configuration flexible
