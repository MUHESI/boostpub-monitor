# API Documentation - BoostPub Monitor

## Vue d'ensemble

Cette documentation décrit les interfaces et APIs internes du système BoostPub Monitor. Toutes les interfaces sont écrites en TypeScript avec des types stricts.

## Interfaces principales

### Configuration

#### MonitorConfig
Configuration principale du système.

```typescript
interface MonitorConfig {
  app: {
    name: string;           // Nom de l'application PM2
    cpuLimit: number;       // Limite CPU en pourcentage
    cpuThreshold: number;   // Seuil CPU pour déclencher les actions
    ramThreshold: number;   // Seuil RAM en MB
  };
  endpoints: {
    alert: string;          // URL pour les alertes HTTP
    report: string;         // URL pour les rapports de nettoyage
  };
  paths: {
    sessions: string;       // Chemin vers les sessions Chrome
    chromeProcess: string;  // Nom du processus Chrome
  };
  logging: {
    level: string;          // Niveau de log (debug, info, warn, error)
    file: string;           // Fichier de log
  };
  intervals: {
    watchdog: number;       // Intervalle watchdog en ms
    monitor: number;        // Intervalle monitor en ms
  };
}
```

#### StartupOptions
Options de démarrage du contrôleur.

```typescript
interface StartupOptions {
  enableWatchdog?: boolean;  // Activer le watchdog
  enableMonitor?: boolean;   // Activer le monitor
  runCleanup?: boolean;      // Exécuter le nettoyage au démarrage
  monitorOnly?: boolean;     // Mode monitor uniquement
}
```

### Logging

#### LogLevel
Niveaux de log disponibles.

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}
```

#### LogMessage
Structure d'un message de log.

```typescript
interface LogMessage {
  timestamp: string;        // Timestamp ISO
  level: LogLevel;          // Niveau de log
  module: string;           // Nom du module
  message: string;          // Message principal
  data?: any;               // Données supplémentaires
}
```

### Surveillance système

#### SystemUsage
Informations d'usage système d'un processus.

```typescript
interface SystemUsage {
  cpu: number;              // Usage CPU en pourcentage
  memPercent: number;       // Usage mémoire en pourcentage
  rssMb: number;            // Mémoire RSS en MB
}
```

#### ProcessInfo
Informations sur un processus.

```typescript
interface ProcessInfo {
  pid: string;              // PID du processus
  name: string;             // Nom du processus
  cpu: number;              // Usage CPU
  memory: number;           // Usage mémoire
}
```

#### SystemStats
Statistiques système complètes.

```typescript
interface SystemStats {
  timestamp: string;
  app: {
    name: string;
    pid: string | null;
    cpu: number;
    memory: number;
    memoryPercent: number;
  };
  system: {
    totalMemory: number;    // Mémoire totale en MB
    freeMemory: number;     // Mémoire libre en MB
    usedMemory: number;     // Mémoire utilisée en MB
    memoryUsage: number;    // Pourcentage d'utilisation
  };
}
```

#### StatsHistory
Historique des statistiques.

```typescript
interface StatsHistory {
  timestamp: string;
  stats: SystemStats;
}
```

### Watchdog

#### AlertData
Données d'alerte envoyées via HTTP.

```typescript
interface AlertData {
  app: string;              // Nom de l'application
  cpu: number;              // Usage CPU au moment de l'alerte
  ram_mb: number;           // Usage RAM au moment de l'alerte
  time: string;             // Timestamp de l'alerte
  action: string;           // Action effectuée
}
```

#### Thresholds
Seuils de surveillance.

```typescript
interface Thresholds {
  cpu: number;              // Seuil CPU
  ram: number;              // Seuil RAM
}
```

### Cleaner

#### CleanupReport
Rapport de nettoyage des sessions.

```typescript
interface CleanupReport {
  timestamp: string;                    // Timestamp du rapport
  totalLocks: number;                   // Nombre total de locks trouvés
  totalLockedFolders: number;           // Nombre de dossiers bloqués
  activeProfilesCount: number;          // Nombre de profils actifs
  orphanFoldersCount: number;           // Nombre de dossiers orphelins
  deletedFoldersCount: number;          // Nombre de dossiers supprimés
  deletedFolders: string[];             // Liste des dossiers supprimés
}
```

#### DeleteResult
Résultat de suppression d'un dossier.

```typescript
interface DeleteResult {
  folder: string;           // Chemin du dossier
  deleted: boolean;         // Succès de la suppression
  error?: string;           // Message d'erreur si échec
}
```

## Classes principales

### Logger

Classe singleton pour la gestion des logs.

```typescript
class Logger {
  // Instance singleton
  static getInstance(): Logger;
  
  // Méthodes de logging
  debug(module: string, message: string, data?: any): void;
  info(module: string, message: string, data?: any): void;
  warn(module: string, message: string, data?: any): void;
  error(module: string, message: string, data?: any): void;
}
```

### Watchdog

Classe pour la surveillance et les actions correctives.

```typescript
class Watchdog {
  // Contrôle du service
  start(): void;
  stop(): void;
  isActive(): boolean;
  
  // Actions manuelles
  manualCheck(): Promise<void>;
}
```

### Monitor

Classe pour la surveillance en temps réel.

```typescript
class Monitor {
  // Contrôle du service
  start(): void;
  stop(): void;
  isActive(): boolean;
  
  // Données
  getSystemStats(): Promise<SystemStats>;
  getHistory(limit?: number): StatsHistory[];
  getAverageStats(minutes?: number): SystemStats | null;
  
  // Gestion de l'historique
  clearHistory(): void;
  exportHistory(): string;
}
```

### Cleaner

Classe pour le nettoyage des sessions.

```typescript
class Cleaner {
  // Nettoyage
  cleanup(): Promise<CleanupReport>;
  
  // Affichage
  displayReport(report: CleanupReport): void;
}
```

### Controller

Classe principale d'orchestration.

```typescript
class Controller {
  // Contrôle principal
  start(options?: StartupOptions): Promise<void>;
  stop(): Promise<void>;
  isActive(): boolean;
  
  // Statut
  getStatus(): {
    controller: boolean;
    watchdog: boolean;
    monitor: boolean;
  };
  
  // Actions manuelles
  manualWatchdogCheck(): Promise<void>;
  getCurrentStats(): Promise<SystemStats>;
  getStatsHistory(limit?: number): StatsHistory[];
}
```

## Fonctions utilitaires

### Commandes shell

```typescript
// Exécution synchrone
function runCommand(cmd: string): string;

// Exécution asynchrone
function runCommandAsync(cmd: string): Promise<string>;
```

### Gestion PM2

```typescript
// Récupération du PID
function getPM2PID(appName: string): string | null;

// Redémarrage d'application
function restartPM2App(appName: string): Promise<void>;
```

### Surveillance système

```typescript
// Usage d'un processus
function getProcessUsage(pid: string): SystemUsage | null;

// Vérification d'existence
function isProcessRunning(pid: string): boolean;
```

### Actions correctives

```typescript
// Limite CPU
function applyCpuLimit(pid: string, limit: number): Promise<void>;

// Nettoyage Chrome
function killChromeSessions(): Promise<void>;
```

### Utilitaires

```typescript
// Délai
function delay(ms: number): Promise<void>;

// Formatage de taille
function formatBytes(bytes: number): string;
```

## Configuration

### Variables d'environnement

| Variable | Type | Défaut | Description |
|----------|------|--------|-------------|
| `APP_NAME` | string | `'bpub-prod'` | Nom de l'application PM2 |
| `CPU_LIMIT` | number | `50` | Limite CPU en pourcentage |
| `CPU_THRESHOLD` | number | `80` | Seuil CPU pour actions |
| `RAM_THRESHOLD` | number | `450` | Seuil RAM en MB |
| `ALERT_ENDPOINT` | string | `''` | URL pour alertes HTTP |
| `REPORT_ENDPOINT` | string | `''` | URL pour rapports |
| `SESSIONS_PATH` | string | `'/var/www/node-apps/boostpub-api/WH_SESSIONS/PROD'` | Chemin sessions |
| `CHROME_PROCESS_NAME` | string | `'chrome'` | Nom processus Chrome |
| `LOG_LEVEL` | string | `'info'` | Niveau de log |
| `LOG_FILE` | string | `'logs/boostpub-monitor.log'` | Fichier de log |
| `WATCHDOG_INTERVAL` | number | `5000` | Intervalle watchdog (ms) |
| `MONITOR_INTERVAL` | number | `1000` | Intervalle monitor (ms) |

### Validation

La fonction `validateConfig()` vérifie :
- Valeurs numériques dans les plages valides
- Chemins de fichiers accessibles
- URLs valides (si fournies)
- Intervalles positifs

## Gestion des erreurs

### Types d'erreurs

1. **ConfigurationError** : Erreurs de configuration
2. **ProcessError** : Erreurs liées aux processus
3. **SystemError** : Erreurs système
4. **NetworkError** : Erreurs réseau (alertes HTTP)

### Stratégie de gestion

- Logging de toutes les erreurs avec contexte
- Tentative de récupération automatique
- Graceful degradation
- Alertes en cas d'erreur critique

## Exemples d'utilisation

### Démarrage complet

```typescript
import { controller } from './src/controller';

await controller.start({
  enableWatchdog: true,
  enableMonitor: true,
  runCleanup: false
});
```

### Surveillance manuelle

```typescript
import { watchdog } from './src/watchdog';

await watchdog.manualCheck();
```

### Nettoyage des sessions

```typescript
import { cleaner } from './src/cleaner';

const report = await cleaner.cleanup();
console.log(`Supprimé ${report.deletedFoldersCount} dossiers`);
```

### Récupération des statistiques

```typescript
import { monitor } from './src/monitor';

const stats = await monitor.getSystemStats();
const history = monitor.getHistory(100);
const averages = monitor.getAverageStats(5);
```
